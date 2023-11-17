// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.17;
 
 import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {ERC20} from "./libraries/ERC20.sol";

import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";

import "./DelegateCall.sol";
import "./ProducerLogic.sol";
import {DataTypes} from "./libraries/DataTypes.sol";
import "./storage/ProducerStorage.sol";
import "./interfaces/IURIGenerator.sol";

contract Producer is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuard,
    DelegateCall,
    PausableUpgradeable,
    ERC1155Upgradeable
{
    IURIGenerator public uriGenerator;
    IProducerStorage public producerStorage;
    ProducerLogic private producerLogic; 

    constructor() {
        _disableInitializers();
    }

    // initialize function for the contract initialize  the contract
    // the contract is initialized by the proxy contract
    // the proxy contract is initialized by the factory contract
    function initialize(
        address payable user,
        address _uriGeneratorAddress,
        address _producerLogicAddress,
        address _producerStorageAddress
    ) external initializer onlyProxy {
        __ERC1155_init("");
        __Ownable_init();
        __Pausable_init();

        uriGenerator = IURIGenerator(_uriGeneratorAddress);
        producerLogic = ProducerLogic(payable(_producerLogicAddress));
        producerStorage = IProducerStorage(_producerStorageAddress);

        _transferOwnership(user);
    }

    // This function adds a new plan to the contract
    function addPlan(
        DataTypes.CreatePlanData calldata vars
       
    ) external onlyOwner {
        // get the address of the producer adding the plan
 
        producerStorage.addPlan(vars);
    }

    // This function returns the producer object stored in the contract

     function getProducer() public view returns (DataTypes.Producer memory) {
     
        
        return producerStorage.getProducer(address(this));
    }  

    // This function updates the producer object stored in the contract

    function setProducer(DataTypes.Producer calldata vars) external onlyOwner {
        producerStorage.setProducer(vars);
    }

    // This function returns the plan object with the given ID
     function getPlan(
        uint256 _planId
    ) public view returns (DataTypes.Plan memory plan) {
      
       
        return producerStorage.getPlan(_planId);
    }  

    // This function returns all the prPlans stored in the contract
    function getPlans() public view returns (DataTypes.Plan[] memory) {
        address add = address(this); 
        return producerStorage.getPlans(add);
    }
 
  

    // This function adds a new customer plan to the contract
    function addCustomerPlan(
        DataTypes.CreateCustomerPlan calldata vars
    ) public {
         

        producerStorage.addCustomerPlan(vars);
     
       uint customerPlanId = producerStorage.getCustomerPlanId(vars.planId, vars.customerAdress, vars.cloneAddress);
     

        _mint(msg.sender, customerPlanId,vars.price, ""); 
    }

    function uri(
        uint256 tokenId
    ) public view override(ERC1155Upgradeable) returns (string memory) { 
          DataTypes.URIParams memory para=  producerStorage.getParams(tokenId);
          
        return uriGenerator.constructTokenURI(para); 
    }

     function getCustomer(
        address adr
    ) public view returns (DataTypes.Customer memory) {
        return producerStorage.getCustomer(adr);
    }  

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);
    }

    function withdrawTokens(ERC20 token) public onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(msg.sender, balance);
    }
}
