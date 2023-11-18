// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import "./../../contracts/fortest/Greeter.sol";
 

contract ContractTest  {
    Greeter public greeter;

    function testCreateGreeter() public {
        greeter = new Greeter("Hello, world!");

        

      
    }

    function test2() public {
     
    }
}
