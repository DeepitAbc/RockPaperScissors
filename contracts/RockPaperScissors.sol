pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

/*
** uses case:
** -> Player1 starts a game with secret move (newGame)
** -> Player2 join the game (joinGame)
** -> player2 reveal the move (revealPlayer2)
** -> player1 reveal the move (revealPlayer1) providing move in clear and SECRET
** -> if player2 not join OR player2 not reveal after expireBlock timeout any user can ask to assign the betAmount (cancelGame) (in this case one/both retrive its beat)
** -> if player2 join AND Reveal and player1 not reveal after expireBlock any user can ask to assign the betAmount (cancelGame) (in this case the winner is player2, all the amounts is provided to player2)
** -> each player can retrive its betAmount on the wallet (withdraw)
*/
contract RockPaperScissors is Pausable {
    using SafeMath for uint256;

    event LogGameCreated(address indexed creator);
    event LogNewGame(address indexed player1, bytes32 moveHash, uint256 betAmount, uint256 expiryBlock);
    event LogGameJoined(address indexed player, bytes32 indexed gameKey);
    event LogPlayer1Revealed(address indexed player, bytes32 gameKey, GameMove move, uint256 winnerId);
    event LogPlayer2Revealed(address indexed player, bytes32 gameKey, GameMove move);
    event LogWithdraw(address indexed player, uint256 amount);
    event LogGameCancelled(address indexed player, bytes32 indexed gameKey, uint256 winnerId);

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
       GameMove player1Move;
       GameMove player2Move;
    }

    // contains the data associated to each game. Each game is indexed by gameKey (play1Move)
    mapping(bytes32 => GameData) public games;

    // balances indexed by user account
    mapping(address => uint256) public balances;


    constructor()  public {
        emit LogGameCreated(msg.sender);
    }

    /*
    ** player1 start new GAME 
    */
    function newGame(bytes32 _move1Hash, uint256 _deltaBlocks, uint256 _betAmount) public whenNotPaused payable returns (bool started) {
        require(_move1Hash != bytes32(0), 'newGame: gameHash invalid');
        require(_deltaBlocks > 0, 'newGame: deltaBlocks is not greater zero');
        require( games[_move1Hash].player1 == address(0), "newGame: hash Already used");

        GameData storage currGame = games[_move1Hash];
        require(msg.value == _betAmount, 'newGame: invalid betAmount');

        currGame.player1 = msg.sender;
        currGame.betAmount = _betAmount;
        uint256 expiryBlock = block.number + _deltaBlocks;
        currGame.expiryBlock = expiryBlock;

        emit LogNewGame(msg.sender, _move1Hash, _betAmount, expiryBlock);
        return true;
    }

    /*
    ** each user play the game using hash of the move
    */
    function joinGame(bytes32 _gameKey) public whenNotPaused payable returns(bool joined) {
        require(_gameKey != bytes32(0), 'joinGame: gameKey invalid');
        require(!timeoutExpired(_gameKey), 'joinGame: timeout' );

        GameData storage currGame = games[_gameKey];
        require(msg.value == currGame.betAmount, 'joinGame: invalid betAmount');
        require(currGame.player1 != address(0) && currGame.player2 == address(0), 'joinGame: wrong key');

        currGame.player2 = msg.sender;
       
        emit LogGameJoined(msg.sender, _gameKey);
        return true;
    }

    /*
    ** Reveal Player2
    */
    function revealPlayer2(bytes32 _gameKey, GameMove _move) public whenNotPaused {
        require(_gameKey != 0, 'revealPlayer2Game: gameKey invalid');
        require(_move == GameMove.PAPER || _move == GameMove.SCISSORS || _move == GameMove.ROCK, 'revealPlayer2Game: invalid Move');
        require(!timeoutExpired(_gameKey), 'revealPlayer2Game: timeout' );
        
        GameData storage currGame = games[_gameKey];

        require(currGame.player2 == msg.sender, 'revealPlayer2Game: msg.sender is not player2');
        require(currGame.player2Move == GameMove.NONE,'revealPlayer2Game: move already revealled');
        currGame.player2Move = _move;

        emit LogPlayer2Revealed(msg.sender, _gameKey, _move);
    }

    /*
    ** Reveal Player1
    */
    function revealPlayer1(bytes32 _gameKey, GameMove _move, bytes32 _password) public whenNotPaused returns(uint256 winnerId) {
        require(_gameKey != 0, 'revealPlayer1: gameKey invalid');
        require(_move == GameMove.PAPER || _move == GameMove.SCISSORS || _move == GameMove.ROCK, 'revealPlayer1: invalid Move');
        require(!timeoutExpired(_gameKey), 'revealPlayer1: timeout' );
        
        GameData storage currGame = games[_gameKey];
        require(currGame.player2Move != GameMove.NONE,'revealPlayer1: player2 has not yet revelled');
        require(currGame.player1 == msg.sender, 'revealPlayer1: msg.sender is not player1');

        require(currGame.player1Move == GameMove.NONE,'revealPlayer1: move already revealled');
        require(_gameKey == moveHash(msg.sender, _move, _password), 'revealPlayer1: move with wrong hash');
        currGame.player1Move = _move;

        winnerId = selectWinner(currGame);
        assignRewards(currGame, winnerId);
        reset(currGame);

        emit LogPlayer1Revealed(msg.sender, _gameKey, _move, winnerId);
        return winnerId;
    }

    function cancelGame(bytes32 _gameKey) public whenNotPaused {
        require(_gameKey != 0, 'cancelGame: gameKey invalid');
        require(timeoutExpired(_gameKey), 'cancelGame: not yet expired' );
        
        GameData storage currGame = games[_gameKey];
        require(currGame.player1 != address(0) && currGame.betAmount != 0, 'cancelGame: wromg game or already closed');

        uint256 winnerId = selectWinner(currGame);
        assignRewards(currGame, winnerId);
        reset(currGame);

        emit LogGameCancelled(msg.sender, _gameKey, winnerId);
    }

    function withdraw() whenNotPaused public {
        uint256 amount = balances[msg.sender];
        require(amount != 0, 'withdraw: no funds');

        balances[msg.sender] = 0;
        emit LogWithdraw(msg.sender, amount);
        msg.sender.transfer(amount);
    }

    function selectWinner(GameData storage currGame) private view returns(uint256 winnerIndex) {
        GameMove move1 = currGame.player1Move;
        GameMove move2 = currGame.player2Move;

        if (move1 == move2) return 0; // same move or nobody reveal(both are NONE)
        if (move1 == GameMove.NONE && move2 != GameMove.NONE) return 2; // reveal only player2 win player2

        // reveal only player1 doesn't happen because before reveal player2 and later player1

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
            // check on player1 is not ncessary because player1 provides always funds
            balances[player1] = balances[player1].add(betAmount);
            if (currGame.player2Move != GameMove.NONE)  { 
               balances[player2] = balances[player2].add(betAmount);
            }
        }
    }

    function reset(GameData storage selectedGame) private {
        // leave player1 set to verify hash reuse
        selectedGame.player2 = address(0);
        selectedGame.player1Move = GameMove.NONE;
        selectedGame.player2Move = GameMove.NONE;
        selectedGame.betAmount = 0;
        selectedGame.expiryBlock = 0;
    }

    function moveHash(address sender, GameMove move, bytes32 password) public view returns(bytes32 secretHash) {
        require(move == GameMove.PAPER || move == GameMove.SCISSORS || move == GameMove.ROCK, 'moveHash: invalid Move');
        return keccak256(abi.encodePacked(this, sender, move, password));
    }

    function timeoutExpired(bytes32 _gameKey) private view returns(bool timedOut) {
        return block.number > games[_gameKey].expiryBlock;
    }
}
