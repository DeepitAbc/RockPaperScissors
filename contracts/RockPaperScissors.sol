pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";

contract RockPaperScissors is Pausable {
    using SafeMath for uint256;

    constructor()  public {
    }
}
