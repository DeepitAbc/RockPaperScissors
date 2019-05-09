pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

contract RockPaperScissors is Pausable {
    using SafeMath for uint256;

    event LogGameCreated(address indexed creator);
    event LogNewGame(address indexed player1, address indexed player2, bytes32 indexed gameHash, uint256 gamePrice, uint256 gameEndBlock);
    event LogGamePlayed(address indexed player, bytes32 indexed gameHash, bytes32 moveHash);
    event LogGameRevealed(address indexed player, bytes32 indexed gameHash, uint8 move, uint256 winnerId);
    event LogWithdraw(address indexed player, uint256 amount);
    event LogGameAborted(address indexed player1, address indexed player2, bytes32 indexed gameHash, uint256 winnerId);

    uint8 MOVE_NONE = 0;
    uint8 MOVE_ROCK = 1;
    uint8 MOVE_PAPER = 2;
    uint8 MOVE_SCISSORS = 3;

    struct GameData {
       uint256 reqPrice;
       uint256 endBlock;
       address player1;
       address player2;
       bytes32 player1MoveHash;
       bytes32 player2MoveHash;
       uint8 player1Move;
       uint8 player2Move;
    }

    mapping(bytes32 => GameData) private games;
    mapping(address => uint256) public balances;

    constructor()  public {
        emit LogGameCreated(msg.sender);
    }

    /*
    ** start new GAME from the identified users
    */
    function newGame(bytes32 _gameHash, address _player1, address _player2,  uint256 _deltaBlocks, uint256 _price) public returns (bool started) {
        require(_gameHash != 0, 'newGame: gameHash invalid');
        require(_player1 != address(0), 'newGame: player1 is null');
        require(_player2 != address(0), 'newGame: player2 is null');
        require(_deltaBlocks > 0, 'newGame: deltaBlocks is not greater zero');

        GameData storage currGame = games[_gameHash];
        // Data structure is freed
        require(currGame.player1 == address(0) && currGame.player2 == address(0));

        currGame.reqPrice = _price;
        currGame.player1 = _player1;
        currGame.player2 = _player2;
        uint256 endBlock = block.number + _deltaBlocks;
        currGame.endBlock = endBlock;

        emit LogNewGame(_player1, _player2, _gameHash, _price, endBlock);

        return true;
    }

    /*
    ** each user play the game using hash of the move
    */
    function playGame(bytes32 _gameHash, bytes32 _moveHash) public payable returns(bool joined) {
        require(_gameHash != 0, 'playGame: gameHash invalid');
        require(!timeoutExpired(_gameHash), 'playGame: timeout' );

        GameData storage currGame = games[_gameHash];
        require(msg.value == currGame.reqPrice, 'playGame: invalid price');
        address player1 = currGame.player1;
        address player2 = currGame.player2;
        if (msg.sender == player1)  {
           require (currGame.player1MoveHash == 0, 'playGame: already moved');
           currGame.player1MoveHash = _moveHash;
        }
        else if (msg.sender == player2)  {
           require (currGame.player2MoveHash == 0, 'playGame: already moved');
           currGame.player2MoveHash = _moveHash;
        }
        else {
           revert ('unexpected player');
        }
       
        emit LogGamePlayed(msg.sender, _gameHash, _moveHash);
        return true;
    }

    /*
    ** when both user are played each user can receal each move
    ** whe both user are moved the contract assign the winner
    */
    function revealGame(bytes32 _gameHash, uint8 _move, bytes32 _password) public returns(uint256 winnerId) {
        require(_gameHash != 0, 'revealGame: gameHash invalid');
        require(_move == MOVE_PAPER || _move == MOVE_SCISSORS || _move == MOVE_ROCK, 'revealGame: invalid Move');
        require(bothUsersArePlayed(_gameHash), 'revealGame: both users have not played yet' );
        require(!timeoutExpired(_gameHash), 'revealGame: timeout' );
        
        GameData storage currGame = games[_gameHash];
        address player1 = currGame.player1;
        address player2 = currGame.player2;

        if (msg.sender == player1)  {
           require(currGame.player1Move == 0, 'revealGame: move already revealled');
           require(currGame.player1MoveHash == moveHash(msg.sender, _move, _password), 'revealGame: move with wrong hash');
           currGame.player1Move = _move;
        }
        else if (msg.sender == player2)  {
           require(currGame.player2Move == 0,'revealGame: move already revealled');
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
           assignFunds(currGame, winnerId);
           cleanGameData(currGame);
        }
        emit LogGameRevealed(msg.sender, _gameHash, _move, winnerId);

        return winnerId;
    }

    function abortGame(bytes32 _gameHash) public returns(uint256 winnerId) {
        require(_gameHash != 0);
        require(timeoutExpired(_gameHash));
        
        GameData storage currGame = games[_gameHash];
        address player1 = currGame.player1;
        address player2 = currGame.player2;
        require(player1 != address(0) && player2 != address(0));

        winnerId = selectWinner(currGame);
        assignFunds(currGame, winnerId);
        cleanGameData(currGame);

        emit LogGameAborted(player1, player2, _gameHash, winnerId);

        return winnerId;
    }

    function withdraw() public {
        uint256 amount = balances[msg.sender];
        require(amount != 0);

        balances[msg.sender] = 0;
        emit LogWithdraw(msg.sender, amount);
        msg.sender.transfer(amount);
    }

    function selectWinner(GameData storage currGame) private view returns(uint256 winnerIndex) {
        uint8 move1 = currGame.player1Move;
        uint8 move2 = currGame.player2Move;
        bytes32 move1Hash = currGame.player1MoveHash;
        bytes32 move2Hash = currGame.player2MoveHash;

        if (move1 == MOVE_NONE && move2 == MOVE_NONE && move1Hash == bytes32(0) && move2Hash == bytes32(0)) return 0;
        if (move1Hash == bytes32(0)) return 2; // only user2 has played
        if (move2Hash == bytes32(0)) return 1; // only user1 has played
        if (move1 == move2) return 0; // same move
        if (move1 == MOVE_ROCK && move2 == MOVE_SCISSORS) return 1;
        if (move1 == MOVE_SCISSORS && move2 == MOVE_ROCK) return 2;
        if (move1 == MOVE_ROCK && move2 == MOVE_PAPER) return 2;
        if (move1 == MOVE_PAPER && move2 == MOVE_ROCK) return 1;
        if (move1 == MOVE_SCISSORS && move2 == MOVE_PAPER) return 1;
        if (move1 == MOVE_PAPER && move2 == MOVE_SCISSORS) return 2;
    }

    function assignFunds(GameData storage currGame, uint256 winnerId) private {
        address player1 = currGame.player1;
        address player2 = currGame.player2;
        uint256 price = currGame.reqPrice;

        if (winnerId == 1) {
            balances[player1] = balances[player1].add(price.mul(2));
        }
        else if (winnerId == 2) {
            balances[player2] = balances[player2].add(price.mul(2));
        }
        else {
            bytes32 move1Hash = currGame.player1MoveHash;
            bytes32 move2Hash = currGame.player2MoveHash;

            if (move1Hash != bytes32(0))  { // has played
               balances[player1] = balances[player1].add(price);
            }
            if (move2Hash != bytes32(0))  { // has played
               balances[player2] = balances[player2].add(price);
            }
        }
    }

    function cleanGameData(GameData storage selectedGame) private {
        selectedGame.player1 = address(0);
        selectedGame.player2 = address(0);
        selectedGame.player1MoveHash = 0;
        selectedGame.player2MoveHash = 0;
        selectedGame.player1Move = 0;
        selectedGame.player2Move = 0;
    }

    function gameHash(address _player1, address _player2) public view returns(bytes32 secretHash) {
        require(_player1 != address(0) && _player2 != address(0),'gameHash: invalid player');
        return keccak256(abi.encodePacked(this, block.number, _player1, _player2));
    }

    function moveHash(address sender, uint8 move, bytes32 password) public view returns(bytes32 secretHash) {
        require(move == MOVE_PAPER || move == MOVE_SCISSORS || move == MOVE_ROCK, 'moveHash: invalid Move');
        return keccak256(abi.encodePacked(this, sender, move, password));
    }

    function getGameInfo(bytes32 _gameHash) public view returns(uint256 price, uint256 endBlock, address player1, bytes32 move1Hash, uint8 move1, address player2, bytes32 move2Hash, uint8 move2) {
        GameData memory currGame = games[_gameHash];
        return (currGame.reqPrice, currGame.endBlock, currGame.player1, currGame.player1MoveHash, currGame.player1Move, currGame.player2, currGame.player2MoveHash, currGame.player2Move);
    }

    function bothUsersArePlayed(bytes32 _gameHash) public view returns(bool done) {
        return (games[_gameHash].player1MoveHash != bytes32(0) && games[_gameHash].player2MoveHash != bytes32(0));
    }

    function bothUsersAreRevealed(bytes32 _gameHash) public view returns(bool done) {
        return (games[_gameHash].player1Move != 0 && games[_gameHash].player2Move != 0);
    }

    function timeoutExpired(bytes32 _gameHash) public view returns(bool timedOut) {
        return block.number > games[_gameHash].endBlock;
    }
}
