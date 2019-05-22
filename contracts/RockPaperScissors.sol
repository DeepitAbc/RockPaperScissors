pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

/*
** uses case:
** newGame:       Player1 starts a game with secret move
** joinGame:      Player2 join the game
** revealPlayer2: Player2 reveal its move in clear
** revealPlayer1: Player1 reveal the move providing clear move and SECRET
** cancelGame:    if timeout expired, if player2 not join OR player2 not reveal any user can ask to assign the betAmount(in this case one/both are assigned its beat)
**                if timeout expired, if player2 join AND reveal AND player1 not reveal any user can ask to assign the betAmount(the winner is player2, all the amounts is provided to player2)
** withdraw:      each player can ask to transfer its betAmount to its wallet
*/
contract RockPaperScissors is Pausable {
    using SafeMath for uint256;

    event LogGameCreated(address indexed creator);
    event LogNewGame(address indexed player1, bytes32 moveHash, uint256 betAmount, uint256 expiryBlock);
    event LogGameJoined(address indexed player, bytes32 indexed gameKey, uint256 expiryBlock);
    event LogPlayer1Revealed(address indexed player, bytes32 gameKey, GameMove move, uint256 winnerId);
    event LogPlayer2Revealed(address indexed player, bytes32 gameKey, GameMove move, uint256 expiryBlock);
    event LogWithdraw(address indexed player, uint256 amount);
    event LogGameCancelled(address indexed player, bytes32 indexed gameKey, uint256 winnerId);

    // Do not change position selectWinner() function determine winner using also its value
    enum GameMove{
      NONE,
      ROCK,
      PAPER,
      SCISSORS
    }

    struct GameData {
       uint256 betAmount;
       uint256 expiryBlock;
       uint256 deltaBlocks;
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
    ** player1 start new GAME providing the move in secret
    */
    function newGame(bytes32 _move1Hash, uint256 _deltaBlocks) public whenNotPaused payable returns (bool started) {
        require(_deltaBlocks > 0, 'newGame: deltaBlocks is not greater zero');
        require( games[_move1Hash].player1 == address(0), "newGame: hash Already used");

        GameData storage currGame = games[_move1Hash];

        currGame.player1 = msg.sender;
        currGame.betAmount = msg.value;
        currGame.deltaBlocks = _deltaBlocks;
        uint256 expiryBlock = block.number.add(_deltaBlocks);
        currGame.expiryBlock = expiryBlock;

        emit LogNewGame(msg.sender, _move1Hash, msg.value, expiryBlock);
        return true;
    }

    /*
    ** player2 join the game using the gameKey 
    */
    function joinGame(bytes32 _gameKey) public whenNotPaused payable returns(bool joined) {
        require(_gameKey != bytes32(0), 'joinGame: gameKey invalid');
        require(!timeoutExpired(_gameKey), 'joinGame: timeout' );

        GameData storage currGame = games[_gameKey];
        require(msg.value == currGame.betAmount, 'joinGame: invalid betAmount');
        require(currGame.player1 != address(0) && currGame.player2 == address(0), 'joinGame: wrong key');

        currGame.player2 = msg.sender;
        uint256 expiryBlock = block.number.add(currGame.deltaBlocks);
        currGame.expiryBlock = expiryBlock;
       
        emit LogGameJoined(msg.sender, _gameKey, expiryBlock);
        return true;
    }

    /*
    ** Reveal Player2 in clear
    */
    function revealPlayer2(bytes32 _gameKey, GameMove _move) public whenNotPaused {
        require(_gameKey != 0, 'revealPlayer2Game: gameKey invalid');
        require(_move == GameMove.PAPER || _move == GameMove.SCISSORS || _move == GameMove.ROCK, 'revealPlayer2Game: invalid Move');
        require(!timeoutExpired(_gameKey), 'revealPlayer2Game: timeout' );
        
        GameData storage currGame = games[_gameKey];

        require(currGame.player2 == msg.sender, 'revealPlayer2Game: msg.sender is not player2');
        require(currGame.player2Move == GameMove.NONE,'revealPlayer2Game: move already revealled');
        currGame.player2Move = _move;
        uint256 expiryBlock = block.number.add(currGame.deltaBlocks);
        currGame.expiryBlock = expiryBlock;

        emit LogPlayer2Revealed(msg.sender, _gameKey, _move, expiryBlock);
    }

    /*
    ** Reveal Player1 providing the clear move and the secret
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

    /*
    ** after timeout the game can be cancelled
    */
    function cancelGame(bytes32 _gameKey) public whenNotPaused {
        require(timeoutExpired(_gameKey), 'cancelGame: not yet expired' );
        
        GameData storage currGame = games[_gameKey];
        require(currGame.player1 != address(0) && currGame.betAmount != 0, 'cancelGame: wrong game or already closed');

        uint256 winnerId = selectWinner(currGame);
        assignRewards(currGame, winnerId);
        reset(currGame);

        emit LogGameCancelled(msg.sender, _gameKey, winnerId);
    }

    /*
    ** each players can withdraw its balance (if any)
    */
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

        if (move1 == GameMove.NONE && move2 != GameMove.NONE) return 2; // reveal only player2 win player2

        return (((uint256(move1)+3-uint256(move2))) % 3);
    }

    function assignRewards(GameData storage currGame, uint256 winnerId) private {
        uint256 betAmount = currGame.betAmount;

        if (winnerId == 1) {
            address player1 = currGame.player1;
            balances[player1] = balances[player1].add(betAmount.mul(2));
        }
        else if (winnerId == 2) {
            address player2 = currGame.player2;
            balances[player2] = balances[player2].add(betAmount.mul(2));
        }
        else {
            address player1 = currGame.player1;
            address player2 = currGame.player2;

            // check on player1 is not ncessary because player1 provides always funds
            balances[player1] = balances[player1].add(betAmount);

            // if player2 is joined is necessary rewards its funds evenf if not reveal
            if (currGame.player2 != address(0))  { 
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
        selectedGame.deltaBlocks = 0;
    }

    function moveHash(address sender, GameMove move, bytes32 password) public view returns(bytes32 secretHash) {
        require(move == GameMove.PAPER || move == GameMove.SCISSORS || move == GameMove.ROCK, 'moveHash: invalid Move');
        return keccak256(abi.encodePacked(this, sender, move, password));
    }

    function timeoutExpired(bytes32 _gameKey) public view returns(bool timedOut) {
        return block.number > games[_gameKey].expiryBlock;
    }
}
