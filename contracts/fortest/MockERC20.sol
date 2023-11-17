// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20, Ownable {
    constructor() ERC20("SADE TOKEN", "SADE") {}

    function mint(address _to, uint256 _amount) external   {
        _mint(_to, _amount);
    }
}
