// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

 
import "hardhat/console.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Base64} from "./libraries/Base64.sol";
contract ProducerLogic  is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
    {
    
      function initialize() external initializer onlyProxy {
        __Ownable_init();
    }
        /**
     * Function required by UUPS proxy pattern
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}
    
 
  
    }