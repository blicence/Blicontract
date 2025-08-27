// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import {DataTypes} from "./../libraries/DataTypes.sol";
import {IFactory} from "./../interfaces/IFactory.sol";

interface IProducerStorage {
    function setFactory(
        IFactory _factory,
        address _producerApi,
        address _producerUsageApi,
        address _producervestingApi
    ) external;

    function exsistProducer(
        address _producerAddress
    ) external view returns (bool);
 function exsistProducerClone(address producerAddres) external view returns (bool);
    function addProducer(DataTypes.Producer calldata vars) external;

    function setProducer(DataTypes.Producer calldata vars) external;

    function addPlan(
        DataTypes.Plan calldata vars
    ) external returns (uint256 planId);

    function addPlanInfoApi(DataTypes.PlanInfoApi calldata vars) external;

    function addPlanInfoNUsage(DataTypes.PlanInfoNUsage calldata vars) external;

    function addPlanInfoVesting(
        DataTypes.PlanInfoVesting calldata vars
    ) external;

    function setPlan(DataTypes.Plan calldata vars) external;

    function getProducer(
        address cloneAddress
    ) external view returns (DataTypes.Producer memory);
       function getProducerInfo(
        address producerAddress
    ) external view returns (DataTypes.Producer memory);

    function getPlan(
        uint256 _planId
    ) external view returns (DataTypes.Plan memory plan);

    function getPlanInfoApi(
        uint256 _planId
    ) external view returns (DataTypes.PlanInfoApi memory pInfoApi);

    function getPlanInfoNUsage(
        uint256 _planId
    ) external view returns (DataTypes.PlanInfoNUsage memory plan);

    function getPlanInfoVesting(
        uint256 _planId
    ) external view returns (DataTypes.PlanInfoVesting memory plan);

   

    function getPlans(
        address producerAddress
    ) external view returns (DataTypes.Plan[] memory);
 
    function getCustomer(
        address customerAddress
    ) external view returns (DataTypes.Customer memory);
 
  function getCustomerPlan(uint custumerPlanId ) external view  returns (DataTypes.CustomerPlan memory) ;
    function getCustomerPlanId(
        uint256 planid,
        address customeraddress,
        address producerAddress
    ) external pure returns (uint);

  

    function addCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    ) external  ;

    function useFromQuota(
        DataTypes.CustomerPlan calldata vars
    ) external returns (uint256);

    function updateCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    ) external;

    function exsitCustomerPlan(
        uint256 planId,
        address customerAddress,
        address cloneAddress
    ) external view returns (bool);

    function SetCloneId(uint256 _producerId, address _cloneAddress) external;

    function getCloneId(uint256 _producerId) external view returns (address);

    function getClones() external view returns (address[] memory);

    function incrementPR_ID() external returns (uint256);

    function currentPR_ID() external view returns (uint256);

 
    // function currenPL_ID() external view returns (uint256);
}
