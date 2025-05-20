// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
/* import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol"; */
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
 
import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
import {ERC20} from "./libraries/ERC20.sol";
import "./DelegateCall.sol";
import {DataTypes} from "./libraries/DataTypes.sol";
import "./storage/ProducerStorage.sol";
import "./interfaces/IURIGenerator.sol";
import "./interfaces/IProducerApi.sol";
import "./interfaces/IProducerNUsage.sol";
import "./interfaces/IProducerVestingApi.sol";

contract Producer is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuard,
    DelegateCall,
    PausableUpgradeable/* ,
    ERC1155Upgradeable */
{
    IURIGenerator public uriGenerator;
    IProducerStorage public producerStorage;
    IProducerNUsage public producerNUsage;
    IProducerVestingApi public producerVestingApi;
    IProducerApi public producerApi;

   event LogAddPlan(
        uint256 planId,
        address producerAddress,
        string name,
        DataTypes.PlanTypes planType
    );
    constructor() {
        _disableInitializers();
    }

    // initialize function for the contract initialize  the contract
    // the contract is initialized by the proxy contract
    // the proxy contract is initialized by the factory contract
    function initialize(
        address payable user,
        address _uriGeneratorAddress,
        address _producerApiAddress,
        address _producerNUsageAddress,
        address _producerVestingApiAddress,
        address _producerStorageAddress
    ) external initializer onlyProxy {
       /*  __ERC1155_init(""); */
        __Ownable_init();
        __Pausable_init();

        uriGenerator = IURIGenerator(_uriGeneratorAddress);

        producerStorage = IProducerStorage(_producerStorageAddress);
        producerApi = IProducerApi(_producerApiAddress);
        producerNUsage = IProducerNUsage(_producerNUsageAddress);
        producerVestingApi = IProducerVestingApi(_producerVestingApiAddress);

        _transferOwnership(user);
    }

    modifier onlyExistCustumer(
        uint256 planId,
        address customerAddress,
        address cloneAddress
    ) {
        require(
            producerStorage.exsitCustomerPlan(
                planId,
                customerAddress,
                cloneAddress
            ) == true,
            "Customer plan not exist"
        );
        _;
    }
modifier onlyCustomer(address   customerAddress) {
        require(
            producerStorage.getCustomer(address(customerAddress)).customer ==
                address(msg.sender),
            "only customer can call this function"
        );
        _;
    }

 
    // This function adds a new plan to the contract
    function addPlan(
        DataTypes.Plan calldata vars
    ) external onlyOwner   returns (uint256 planId) {
        // get the address of the producer adding the plan

       planId= producerStorage.addPlan(vars);
        emit LogAddPlan(planId, address(this), vars.name, vars.planType);
       return planId;
        
    }

    function addPlanInfoApi(DataTypes.PlanInfoApi calldata vars
    ) external onlyOwner
    {
        producerStorage.addPlanInfoApi(vars);
        
    }

    function addPlanInfoNUsage(DataTypes.PlanInfoNUsage calldata vars
    ) external onlyOwner
    {
        producerStorage.addPlanInfoNUsage(vars);
    }

    function addPlanInfoVesting(DataTypes.PlanInfoVesting calldata vars
    ) external onlyOwner
    {
        producerStorage.addPlanInfoVesting(vars);
    }

    // This function updates the plan object stored in the contract
    function setPlan(
        DataTypes.Plan calldata vars
    ) external onlyOwner {
        producerStorage.setPlan(vars);
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
    function addCustomerPlan(DataTypes.CustomerPlan memory vars) public    {
     
        
        if (vars.planType == DataTypes.PlanTypes.vestingApi) {
            producerVestingApi.addCustomerPlan(vars);
        }
        if (vars.planType == DataTypes.PlanTypes.nUsage) {
            
            // todo add payment to the producer
            DataTypes.PlanInfoNUsage memory pInfoNUsage= producerStorage.getPlanInfoNUsage(vars.planId);
            DataTypes.Plan memory plan= producerStorage.getPlan(vars.planId);
            require(vars.remainingQuota >0, "remainingQuota must be higher than zero!");
            require(ERC20(address(plan.priceAddress)).balanceOf(msg.sender) >= pInfoNUsage.oneUsagePrice*vars.remainingQuota, "Amount must be higher than zero!");
        
           /*  ERC20(address(plan.priceAddress)).transferFrom(msg.sender, address(this), pInfoNUsage.oneUsagePrice*vars.remainingQuota); */
           SafeTransferLib.safeTransferFrom(ERC20(address(plan.priceAddress)), msg.sender, address(this), pInfoNUsage.oneUsagePrice*vars.remainingQuota);
            producerNUsage.addCustomerPlan(vars);
 
        }
        if (vars.planType == DataTypes.PlanTypes.api) {
            producerApi.addCustomerPlan(vars);
        }
        uriGenerator.mint(vars);
 
    }

    function updateCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    ) public onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress) onlyCustomer(msg.sender) {
       
            if (vars.planType == DataTypes.PlanTypes.vestingApi) {
            producerVestingApi.updateCustomerPlan(vars);
        }
        if (vars.planType == DataTypes.PlanTypes.nUsage) {
            if(vars.status==DataTypes.Status.inactive){
                // return the remaining quota to the customer 
                 DataTypes.Plan memory plan= producerStorage.getPlan(vars.planId);
               uint256  custumerPlanId =producerStorage.getCustomerPlanId(vars.planId,msg.sender,vars.cloneAddress);

                   DataTypes.CustomerPlan memory cpnu= producerStorage.getCustomerPlan(custumerPlanId);
                    require(cpnu.remainingQuota >0, "remainingQuota must be higher than zero!");
                    DataTypes.PlanInfoNUsage memory pInfoNUsage= producerStorage.getPlanInfoNUsage(vars.planId);
                
                
                
                  SafeTransferLib.safeTransferFrom(ERC20(address(plan.priceAddress)),address(this),msg.sender ,  (pInfoNUsage.oneUsagePrice)*cpnu.remainingQuota);
            }
            producerNUsage.updateCustomerPlan(vars);
        }
        if (vars.planType == DataTypes.PlanTypes.api) {
            producerApi.updateCustomerPlan(vars);
        }
        if (vars.status == DataTypes.Status.inactive) {
           uriGenerator.burn(vars);
        } 
    }
   function useFromQuota(
        DataTypes.CustomerPlan calldata vars
    )
        public onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress) onlyCustomer(msg.sender) 
      
        returns (uint256)
    {
           if (vars.planType == DataTypes.PlanTypes.nUsage) {
          return  producerNUsage.useFromQuota(vars);
        }
        return 0;
    }
    function uri(
        uint256 tokenId
    ) public view   returns (string memory) {
      

        return uriGenerator.uri(tokenId);
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
