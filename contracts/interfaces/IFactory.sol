// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;
import {DataTypes} from "./../libraries/DataTypes.sol";

interface IFactory {
    function initialize(
      address _uriGeneratorAddress,
         address _producerStorageAddress, 
        address _producerApiAddress,
        address _producerNUsageAddress,
        address _producerVestingApiAddress
    ) external;

    function getProducerImplementation() external view returns (address);

    function setProducerImplementation(
        address _ProducerImplementationAddress
    ) external;

    function newBcontract(DataTypes.Producer calldata vars) external;

    function getProducerInfo(
        address proAddress
    ) external view returns (DataTypes.Producer memory info);

    function currentPR_ID() external view returns (uint256);

    function incrementPR_ID() external returns (uint256);

    function getClones() external view returns (address[] memory);
}

