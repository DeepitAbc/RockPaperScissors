pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

/*
** uses case:
** -> Player1 starts a game with secret move (newGame)
** -> Player2 join the game and provides secret move (playGame)
** -> each player reveal the move (revealGame), when the second player reveal the contract assign the rewards to the winner 
** -> each player can retrive its betAmount (withdraw)
** -> if player2 doesn't play after expireBlock timeout the player1 can retrive the betAmount (cancelGame)
*/
contract RockPaperScissors is Pausable {
    using SafeMath for uint256;

    event LogGameCreated(address indexed creator);
    event LogNewGame(address indexed player1, bytes32 indexed gameHash, bytes32 moveHash, uint256 betAmount, uint256 expiryBlock);
    event LogGameJoined(address indexed player, bytes32 indexed gameHash, bytes32 moveHash);
    event LogGameRevealed(address indexed player, bytes32 indexed gameHash, GameMove move, uint256 winnerId);
    event LogWithdraw(address indexed player, uint256 amount);
    event LogGameCancelled(address indexed player, bytes32 indexed gameHash, uint256 winnerId);

    enum GameMove{
      NONE,
      ROCK,
      PAPER,
      SCISSORS
    }

    struct GameData {
       uint256 betAmount;
       uint256 expiryBlock;
       address player1;
       address player2;
       bytes32 player1MoveHash;
       bytes32 player2MoveHash;
       GameMove player1Move;
       GameMove player2Move;
    }

    // contains the data associated to each game. Each game is indexed by gameHash
    mapping(bytes32 => GameData) public games;

    // balances indexed by user account
    mapping(address => uint256) public balances;

    // Store the moveHash used by players */
    mapping(bytes32 => address) public hashAlreadyUsed;


    constructor()  public {
        emit LogGameCreated(msg.sender);
    }

    /*
    ** start new GAME from the identified users
    */
    function newGame(bytes32 _gameHash, bytes32 _move1Hash, uint256 _deltaBlocks, uint256 _betAmount) public whenNotPaused payable returns (bool started) {
        require(_gameHash != 0, 'newGame: gameHash invalid');
        require(_deltaBlocks > 0, 'newGame: deltaBlocks is not greater zero');
        require( hashAlreadyUsed[_move1Hash] == address(0), "Hash Already used");

        hashAlreadyUsed[_move1Hash] = msg.sender;
        GameData storage currGame = games[_gameHash];
        require(msg.value == _betAmount, 'newGame: invalid betAmount');
        // Data structure is freed
        require(currGame.player1 == address(0) && currGame.player2 == address(0));

        currGame.betAmount = _betAmount;
        currGame.player1 = msg.sender;
        currGame.player1MoveHash = _move1Hash;
        uint256 expiryBlock = block.number + _deltaBlocks;
        currGame.expiryBlock = expiryBlock;

        emit LogNewGame(msg.sender, _gameHash, _move1Hash, _betAmount, expiryBlock);

        return true;
    }

    /*
    ** each user play the game using hash of the move
    */
    function joinGame(bytes32 _gameHash, bytes32 _moveHash) public whenNotPaused payable returns(bool joined) {
        require(_gameHash != 0, 'joinGame: gameHash invalid');
        require(!timeoutExpired(_gameHash), 'joinGame: timeout' );
        require( hashAlreadyUsed[_moveHash] == address(0), "Hash Already used");

        hashAlreadyUsed[_moveHash] = msg.sender;

        GameData storage currGame = games[_gameHash];
        require(msg.value == currGame.betAmount, 'joinGame: invalid betAmount');
        address player1 = currGame.player1;
        address player2 = currGame.player2;
        require(player1 != address(0) && player2 == address(0), 'joinGame: invalid betAmount');

        currGame.player2 = msg.sender;
        currGame.player2MoveHash = _moveHash;
       
        emit LogGameJoined(msg.sender, _gameHash, _moveHash);
        return true;
    }

    /*
    ** when both user are played each user can receal each move
    ** whe both user are moved the contract assign the winner
    */
    function revealGame(bytes32 _gameHash, GameMove _move, bytes32 _password) public whenNotPaused returns(uint256 winnerId) {
        require(_gameHash != 0, 'revealGame: gameHash invalid');
        require(_move == GameMove.PAPER || _move == GameMove.SCISSORS || _move == GameMove.ROCK, 'revealGame: invalid Move');
        require(bothUsersArePlayed(_gameHash), 'revealGame: both users have not played yet' );
        require(!timeoutExpired(_gameHash), 'revealGame: timeout' );
        
        GameData storage currGame = games[_gameHash];
        address player1 = currGame.player1;
        address player2 = currGame.player2;

        if (msg.sender == player1)  {
           require(currGame.player1Move == GameMove.NONE, 'revealGame: move already revealled');
           require(currGame.player1MoveHash == moveHash(msg.sender, _move, _password), 'revealGame: move with wrong hash');
           currGame.player1Move = _move;
        }
        else if (msg.sender == player2)  {
           require(currGame.player2Move == GameMove.NONE,'revealGame: move already revealled');
           require(currGame.player2MoveHash == moveHash(msg.sender, _move, _password), 'revealGame: move with wrong hash');
           currGame.player2Move = _move;
        }
        else {
           revert ('unexpected player');
        }

        if (!bothUsersAreRevealed(_gameHash)) {
          winnerId = 0;
        }
        else {
           winnerId = selectWinner(currGame);
           assignRewards(currGame, winnerId);
           reset(currGame);
        }
        emit LogGameRevealed(msg.sender, _gameHash, _move, winnerId);

        return winnerId;
    }

    function cancelGame(bytes32 _gameHash) public whenNotPaused returns(uint256 winnerId) {
        require(_gameHash != 0);
        require(timeoutExpired(_gameHash));
        
        GameData storage currGame = games[_gameHash];
        address player1 = currGame.player1;
        require(player1 != address(0));

        winnerId = selectWinner(currGame);
        assignRewards(currGame, winnerId);
        reset(currGame);

        emit LogGameCancelled(msg.sender, _gameHash, winnerId);

        return winnerId;
    }

    function withdraw() whenNotPaused public {
        uint256 amount = balances[msg.sender];
        require(amount != 0);

        balances[msg.sender] = 0;
        emit LogWithdraw(msg.sender, amount);
        msg.sender.transfer(amount);
    }

    function selectWinner(GameData storage currGame) private view returns(uint256 winnerIndex) {
        GameMove move1 = currGame.player1Move;
        GameMove move2 = currGame.player2Move;

        if (move1 == move2) return 0; // same move or nobody reveal (both are NONE)
        if (move2 == GameMove.NONE || move1 == GameMove.NONE) return 0; // reveal only one player
        if (move1 == GameMove.ROCK && move2 == GameMove.SCISSORS) return 1;
        if (move1 == GameMove.SCISSORS && move2 == GameMove.ROCK) return 2;
        if (move1 == GameMove.ROCK && move2 == GameMove.PAPER) return 2;
        if (move1 == GameMove.PAPER && move2 == GameMove.ROCK) return 1;
        if (move1 == GameMove.SCISSORS && move2 == GameMove.PAPER) return 1;
        if (move1 == GameMove.PAPER && move2 == GameMove.SCISSORS) return 2;
    }

    function assignRewards(GameData storage currGame, uint256 winnerId) private {
        address player1 = currGame.player1;
        address player2 = currGame.player2;
        uint256 betAmount = currGame.betAmount;

        if (winnerId == 1) {
            balances[player1] = balances[player1].add(betAmount.mul(2));
        }
        else if (winnerId == 2) {
            balances[player2] = balances[player2].add(betAmount.mul(2));
        }
        else {
            bytes32 move1Hash = currGame.player1MoveHash;
            bytes32 move2Hash = currGame.player2MoveHash;

            if (move1Hash != bytes32(0))  { // has played
               balances[player1] = balances[player1].add(betAmount);
            }
            if (move2Hash != bytes32(0))  { // has played
               balances[player2] = balances[player2].add(betAmount);
            }
        }
    }

    function reset(GameData storage selectedGame) private {
        selectedGame.player1 = address(0);
        selectedGame.player2 = address(0);
        selectedGame.player1MoveHash = 0;
        selectedGame.player2MoveHash = 0;
        selectedGame.player1Move = GameMove.NONE;
        selectedGame.player2Move = GameMove.NONE;
        selectedGame.betAmount = 0;
        selectedGame.expiryBlock = 0;
    }

    function gameHash(address _player1, address _player2) public view returns(bytes32 secretHash) {
        require(_player1 != address(0) && _player2 != address(0),'gameHash: invalid player');
        return keccak256(abi.encodePacked(this, block.number, _player1, _player2));
    }

    function moveHash(address sender, GameMove move, bytes32 password) public view returns(bytes32 secretHash) {
        require(move == GameMove.PAPER || move == GameMove.SCISSORS || move == GameMove.ROCK, 'moveHash: invalid Move');
        return keccak256(abi.encodePacked(this, sender, move, password));
    }

    function bothUsersArePlayed(bytes32 _gameHash) private view returns(bool done) {
        return (games[_gameHash].player1MoveHash != bytes32(0) && games[_gameHash].player2MoveHash != bytes32(0));
    }

    function bothUsersAreRevealed(bytes32 _gameHash) private view returns(bool done) {
        return (games[_gameHash].player1Move != GameMove.NONE && games[_gameHash].player2Move != GameMove.NONE);
    }

    function timeoutExpired(bytes32 _gameHash) private view returns(bool timedOut) {
        return block.number > games[_gameHash].expiryBlock;
    }
}
