# RockPaperScissors
You will create a smart contract named RockPaperScissors whereby:

Alice and Bob play the classic rock paper scissors game.
to enrol, each player needs to deposit the right Ether amount, possibly zero.
to play, each player submits their unique move.
the contract decides and rewards the winner with all Ether wagered.
Of course there are many ways to implement it so we leave to yourselves to invent.

How can this be the 3rd project and not the 1st?? Try.

Stretch goals:

make it a utility whereby any 2 people can decide to play against each other.
reduce gas costs as much as you can.
let players bet their previous winnings.
how can you entice players to play, knowing that they may have their funding stuck in the contract if they faced an uncooperative player?


Implementation Choice:
 -> newGame:       Player1 starts a game with secret move
 -> joinGame:      Player2 join the game
 -> revealPlayer2: Player2 reveal its move in clear
 -> revealPlayer1: Player1 reveal the move providing clear move and SECRET
 -> cancelGame:    if timeout expired, if player2 not join OR player2 not reveal any user can ask to assign the betAmount(in this case one/both are assigned its beat)
 ->                if timeout expired, if player2 join AND reveal AND player1 not reveal any user can ask to assign the betAmount(the winner is player2, all the amounts is provided to player2)
 -> withdraw:      each player can ask to transfer its betAmount to its wallet


Contract: DONE
Test: DONE
UI: DONE
