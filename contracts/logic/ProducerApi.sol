// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;
 

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Base64} from "./../libraries/Base64.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//import {ISuperfluid, ISuperToken, ISuperfluidToken, ISuperApp, ISuperAgreement, SuperAppDefinitions, SuperAppBase} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
//import {ApiSuperAppBaseFlow} from "./../libraries/ApiSuperAppBaseFlow.sol";
 import {ISuperfluid, ISuperToken, ISuperfluidToken, ISuperApp } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

//import {CFAv1Library} from "@superfluid-finance/ethereum-contracts/contracts/apps/CFAv1Library.sol";
//import {IConstantFlowAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import {DataTypes} from "./../libraries/DataTypes.sol";
import {IProducerStorage} from "./../interfaces/IProducerStorage.sol";
import "./../interfaces/IProducerApi.sol";
import {SuperTokenV1Library} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";

contract ProducerApi is
    IProducerApi,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
       using SuperTokenV1Library for ISuperToken;
    IProducerStorage public producerStorage;
    /* --- Superfluid --- */
   /*  using CFAv1Library for CFAv1Library.InitData;
    CFAv1Library.InitData public cfaV1;
    bytes32 public constant CFA_ID =
        keccak256("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    IConstantFlowAgreementV1 cfa; */
  
    event startedStream(
        address indexed customerAdress,
        address producer 
    );
    event stoppedStream(
        address indexed customerAdress,
        address producer 
    );
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

    function initialize()  external initializer onlyProxy {
        __Ownable_init();
    } 
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

/*     function SetSuperInitialize(address _host) external   {
    
        host = ISuperfluid(_host);
        cfa = IConstantFlowAgreementV1(address(host.getAgreementClass(CFA_ID)));
        cfaV1 = CFAv1Library.InitData(host, cfa);
        uint256 configWord = SuperAppDefinitions.APP_LEVEL_FINAL |
            SuperAppDefinitions.BEFORE_AGREEMENT_CREATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_UPDATED_NOOP |
            SuperAppDefinitions.BEFORE_AGREEMENT_TERMINATED_NOOP;

        host.registerApp(configWord);
    }
 */
    function setProducerStorage(address _producerStorage) external onlyOwner {
        producerStorage = IProducerStorage(_producerStorage);
    }

    modifier onlyProducer(address _cloneAddress) {
        require(
            producerStorage.getProducer(_cloneAddress).cloneAddress ==
                msg.sender,
            "Only producer contract can call this function"
        );
        _;
    }
    modifier OnlyRightProducer(uint256 _producerId, address cloneAddress) {
        require(
            producerStorage.getCloneId(_producerId) == cloneAddress,
            "right producer contract can call this function"
        );
        _;
    }

    /**
     * @dev Adds a customer plan.
     * @param vars The data required to create a customer plan.
     * @notice This function wraps tokens, creates a flow, and emits a `startedStream` event.
     * @notice The `getFlow` function is used to check if a flow already exists for the given addresses.
     * @notice The `createFlow` function is used to create a new flow for the given addresses.
     * @notice The `startedStream` event is emitted when a new flow is created.
     * @notice This function can only be called by the contract owner.
     */
    function addCustomerPlan(
        DataTypes.CustomerPlan memory vars
    ) external onlyProducer(vars.cloneAddress) {
         DataTypes.PlanInfoApi memory planInfoApi= producerStorage.getPlanInfoApi(vars.planId);
 
        
     
         
        // wrap tokens
     /*  require(
            getFlow(
                address(vars.priceAddress),
                address(vars.customerAdress),
                address(this)
            ) > 0,
            "flow already exist for this address"
        );    */
   
                
   
            ISuperToken(vars.priceAddress).createFlowFrom(vars.customerAdress, vars.cloneAddress,  planInfoApi.flowRate); 
        producerStorage.addCustomerPlan(vars);
        emit startedStream(vars.cloneAddress, vars.customerAdress);
    }

    /**
     * @dev Deletes an existing flow and creates a new flow if the status is active.
     * @param vars The data required to delete and create a flow.
     * @notice This function deletes an existing flow and creates a new flow if the status is active.
     * @notice The `deleteFlow` function is used to delete an existing flow for the given addresses.
     * @notice The `createFlow` function is used to create a new flow for the given addresses.
     * @notice The `startedStream` event is emitted when a new flow is created.
     * @notice The `stoppedStream` event is emitted when an existing flow is deleted.
     * @notice This function can only be called by the contract onlyProducer address.
     */
    function updateCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    )
        external
        onlyProducer(vars.cloneAddress)
        OnlyRightProducer(vars.producerId, vars.cloneAddress)
    {
        require(
            getFlow(
                address(vars.priceAddress),
                address(vars.customerAdress),
                address(this)
            ) <= 0,
            "flow non exist for this address this token"
        );

        deleteFlow(
            address(vars.priceAddress),
            address(vars.cloneAddress),
            address(vars.customerAdress)
        );

        /*  if(vars.status==DataTypes.Status.inactive){
           
            deleteFlow(
                address(vars.cApi.superToken),
                address(vars.cloneAddress),
                address(vars.customerAdress)
            );
            emit stoppedStream(vars.cloneAddress, vars.customerAdress, vars.cApi);
        } */
        if (vars.status == DataTypes.Status.active) {

                                        DataTypes.PlanInfoApi memory planInfoApi= producerStorage.getPlanInfoApi(vars.planId);

            // create flow
            createFlow(
                address(vars.cloneAddress),
                address(vars.priceAddress),
                planInfoApi.flowRate
            );
            emit startedStream(
                vars.cloneAddress,
                vars.customerAdress
             
            );
        }
        producerStorage.updateCustomerPlan(vars);
    }

    /*   Superfluid   */

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

    function createFlow(
        address superTokenAddress,
        address receiver,
        int96 flowRate
    ) internal {
           ISuperToken(superTokenAddress).createFlow(receiver, flowRate);
    }

    function deleteFlow(
        address superTokenAddress,
        address sender,
        address receiver
    ) internal {
           ISuperToken(superTokenAddress).deleteFlow(
            address(receiver),
            address(sender)
        );
    }

    /**
     * @dev get flow rate between two accounts for given token
     * @param superTokenAddress The token used in flow
     * @param sender The sender of the flow
     * @param receiver The receiver of the flow
     * @return flowRate The flow rate
     */

    function getFlow(
        address superTokenAddress,
        address sender,
        address receiver
    ) public view returns (int96) {
  
        (, int96 flowRate, , ) =    ISuperToken(superTokenAddress).getFlowInfo(sender,
            receiver
        );

        return flowRate;
    }

    /**
     * @dev get flow info between two accounts for given token
     * @param superTokenAddress The token used in flow
     * @param sender The sender of the flow
     * @param receiver The receiver of the flow
     * @return lastUpdated Timestamp of flow creation or last flowrate change
     * @return flowRate The flow rate
     * @return deposit The amount of deposit the flow
     * @return owedDeposit The amount of owed deposit of the flow
     */

    function getFlowInfo(
        address superTokenAddress,
        address sender,
        address receiver
    )
        public
        view
        returns (
            uint256 lastUpdated,
            int96 flowRate,
            uint256 deposit,
            uint256 owedDeposit
        )
    {
        (lastUpdated, flowRate, deposit, owedDeposit) =    ISuperToken(superTokenAddress).getFlowInfo(
         
            sender,
            receiver
        );
    }

    /**
     * @dev get net flow rate for given account for given token
     * @param superToken Super token address
     * @param account Account to query
     * @return flowRate The net flow rate of the account
     */

    function getNetFlow(
        ISuperToken superToken,
        address account
    ) public view returns (int96) {
        return    ISuperToken(superToken).getNetFlowRate( address(account));
    }
}
