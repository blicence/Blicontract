// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {DataTypes} from "./../libraries/DataTypes.sol";

interface IProducerStorage {
    function addProducer(DataTypes.Producer calldata vars) external;

    function setProducer(DataTypes.Producer calldata vars) external;

    function addPlan(
        DataTypes.CreatePlanData calldata vars 
    ) external;

    function getProducer(
        address producerOwner
    ) external view returns (DataTypes.Producer memory);

    function getPlan(
        uint256 _planId
    ) external view returns (DataTypes.Plan memory plan);

    function getPlans(
        address producerAddress
    ) external view returns (DataTypes.Plan[] memory);

    function getParams(
        uint256 tokenId
    ) external view returns (DataTypes.URIParams memory);

    function getCustomer(
        address customerAddress
    ) external view returns (DataTypes.Customer memory);
  

 function getCustomerPlanId(
        uint256 planid,
        address customeraddress,
        address producerAddress
    ) external pure returns (uint);
   
      function addCustomerPlan(
        DataTypes.CreateCustomerPlan calldata vars
    ) external   returns (DataTypes.URIParams memory); 
   function exsistProducer(
        address _producerAddress
    ) external view returns (bool);

 
 

    function SetCloneId(uint256 _producerId, address _cloneAddress) external;

    function getCloneId(uint256 _producerId) external view returns (address);

    function getClones(uint256 id) external view returns (address[] memory);

    function incrementPR_ID() external returns (uint256);

    function currentPR_ID() external view returns (uint256);
     function incrementPL_ID() external   returns (uint256);
    function currenPL_ID() external view returns (uint256);


}
