// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "hardhat/console.sol";

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISuperfluid, ISuperToken, ISuperfluidToken, ISuperApp, ISuperAgreement, SuperAppDefinitions} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {SuperAppBase} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperAppBase.sol";
import {CFAv1Library} from "@superfluid-finance/ethereum-contracts/contracts/apps/CFAv1Library.sol";
import {IConstantFlowAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import {DataTypes} from "./../libraries/DataTypes.sol";
import {Base64} from "./../libraries/Base64.sol";
import "./../interfaces/IFlowScheduler.sol";
import "./../interfaces/IVestingScheduler.sol";
import "./../interfaces/IProducerVestingApi.sol";
import {IProducerStorage} from "./../interfaces/IProducerStorage.sol" ;
contract ProducerVestingApi is
    IProducerVestingApi,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    /* --- Superfluid --- */
    using CFAv1Library for CFAv1Library.InitData;
    CFAv1Library.InitData public cfaV1;
    bytes32 public constant CFA_ID =
        keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    IConstantFlowAgreementV1 cfa;
    ISuperfluid host;
    IFlowScheduler public flowScheduler;
    IVestingScheduler private vestingScheduler;
     IProducerStorage public producerStorage;
    function initialize() external initializer onlyProxy {
        __Ownable_init();
    }
    modifier onlyProducer(address _cloneAddress) {
        require(
            producerStorage.getProducer(_cloneAddress).cloneAddress ==
                msg.sender,
            "Only producer contract can call this function"
        );
        _;
    }
modifier OnlyRightProducer(uint256 _producerId,address cloneAddress){
      require(
            producerStorage.getCloneId(_producerId) ==
                cloneAddress,
            "right producer contract can call this function"
        );
        _;
    }
 
    /**
     * Function required by UUPS proxy pattern
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /*   function setFlowScheduler(address _flowScheduler) external onlyOwner {
        flowScheduler = IFlowScheduler(_flowScheduler);
    } */

    function SetSuperInitialize(
        address _host,
        address _flowScheduler,
        address _vestingScheduler
    ) external onlyOwner {
        assert(address(host) != address(0));
        host = ISuperfluid(_host);
        cfa = IConstantFlowAgreementV1(address(host.getAgreementClass(CFA_ID)));
        cfaV1 = CFAv1Library.InitData(host, cfa);
        flowScheduler = IFlowScheduler(_flowScheduler);
        vestingScheduler = IVestingScheduler(_vestingScheduler);
        uint256 configWord = SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        host.registerApp(configWord);
    }

  function setProducerStorage(address _producerStorage) external onlyOwner {
        producerStorage = IProducerStorage(_producerStorage);
    }
    
    // vestingScheduler imlementation
    // This function adds avesting schedule to the contract
    function createVestingSchedule(
        ISuperToken superToken,
        address receiver,
        uint32 startDate,
        uint32 cliffDate,
        int96 flowRate,
        uint256 startAmount,
        uint32 endDate,
        bytes memory ctx
    ) public {
        console.log("CustumerCreateVestingSchedule");
        vestingScheduler.createVestingSchedule(
            superToken,
            receiver,
            startDate,
            cliffDate,
            flowRate,
            startAmount,
            endDate,
            ctx
        );
    }

    function getVestingSchedule(
        ISuperToken superToken,
        address account,
        address receiver
    ) public view returns (IVestingScheduler.VestingSchedule memory) {
        return
            vestingScheduler.getVestingSchedule(
                address(superToken),
                account,
                receiver
            );
    }

    function updateVestingSchedule(
        ISuperToken superToken,
        address receiver,
        uint32 endDate,
        bytes memory ctx
    ) public returns (bytes memory newCtx) {
        console.log("CustumerUpdateVestingSchedule");

        newCtx = vestingScheduler.updateVestingSchedule(
            superToken,
            receiver,
            endDate,
            ctx
        );
    }

    function deleteVestingSchedule(
        ISuperToken superToken,
        address receiver,
        bytes memory ctx
    ) public returns (bytes memory newCtx) {
        newCtx = vestingScheduler.deleteVestingSchedule(
            superToken,
            receiver,
            ctx
        );
    }

    function addCustomerPlan(
        DataTypes.CreateCustomerPlan calldata vars
    ) public  onlyProducer(vars.cloneAddress) {
         DataTypes.PlanInfoVesting memory planInfoVesting = producerStorage.getPlanInfoVesting(vars.planId);
        createVestingSchedule(
            vars.cInfo.superToken,
            vars.cloneAddress,
          
            vars.cInfo.startDate,
            planInfoVesting.cliffDate,
            planInfoVesting.flowRate,
           planInfoVesting.startAmount,
            vars.cInfo.endDate,
            ""
        );
         producerStorage.addCustomerPlan(vars);
    }

    function updateCustomerPlan(
        DataTypes.UpdateCustomerPlan calldata vars
    ) public onlyProducer(vars.cloneAddress) OnlyRightProducer(vars.producerId,vars.cloneAddress)  {
        
        deleteVestingSchedule(
            vars.cInfo.superToken,
            vars.cloneAddress,
            "");
            
         if (vars.status == DataTypes.Status.active){
        updateVestingSchedule(
            vars.cInfo.superToken,
            vars.cloneAddress,
            vars.cInfo.endDate,
            ""
        );
    }
         producerStorage.updateCustomerPlan(vars);
    }

    function wrapSuperToken(
        address token,
        address superTokenAddress,
        uint amountToWrap
    ) internal {
        // approving to transfer tokens from this to superTokenAddress
        IERC20(token).approve(superTokenAddress, amountToWrap);

        // wrapping and sent to this contract
        ISuperToken(superTokenAddress).upgrade(amountToWrap);
    }

    function unwrapSuperToken(
        address superTokenAddress,
        uint amountToUnwrap
    ) internal {
        // unwrapping
        ISuperToken(superTokenAddress).downgrade(amountToUnwrap);
    }
}
