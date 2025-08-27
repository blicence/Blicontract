// SPDX-License-Identifier: MIT

pragma solidity 0.8.30;
import {DataTypes} from "./../libraries/DataTypes.sol";

interface IFactory {
    function initialize(
        address _uriGeneratorAddress,
        address _producerStorageAddress,
        address _producerApiAddress,
        address _producerNUsageAddress,
        address _producerVestingApiAddress,
        address _streamLockManagerAddress
    ) external;

    function getProducerImplementation() external view returns (address);

    function setProducerImplementation(
        address _ProducerImplementationAddress
    ) external;

    function newBcontract(DataTypes.Producer calldata vars) external;

  

    function currentPR_ID() external view returns (uint256);

    function incrementPR_ID() external returns (uint256);

 }

