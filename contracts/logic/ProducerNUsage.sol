// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;
 

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Base64} from "./../libraries/Base64.sol";
import {DataTypes} from "./../libraries/DataTypes.sol";
import {IProducerStorage} from "./../interfaces/IProducerStorage.sol";
import {IProducerNUsage} from "./../interfaces/IProducerNUsage.sol";

contract ProducerNUsage is
    IProducerNUsage,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    IProducerStorage public producerStorage;

    function initialize() external initializer onlyProxy {
        __Ownable_init();
    }

    /**
     * Function required by UUPS proxy pattern
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

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

    function setProducerStorage(address _producerStorage) external onlyOwner {
        producerStorage = IProducerStorage(_producerStorage);
    }

    function addCustomerPlan(
        DataTypes.CustomerPlan memory vars
    ) external onlyProducer(vars.cloneAddress) {
        producerStorage.addCustomerPlan(vars);
    }

    function updateCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    )
        external
        onlyProducer(vars.cloneAddress)
        OnlyRightProducer(vars.producerId, vars.cloneAddress)
    {
        producerStorage.updateCustomerPlan(vars);
    }

    function useFromQuota(
        DataTypes.CustomerPlan calldata vars
    )
        external
        onlyProducer(vars.cloneAddress)
        OnlyRightProducer(vars.producerId, vars.cloneAddress)
        returns (uint256)
    {
        return producerStorage.useFromQuota(vars);
    }
}
