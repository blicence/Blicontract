// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./Producer.sol";
import "./DelegateCall.sol";
import {DataTypes} from "./libraries/DataTypes.sol";
import {IFactory} from "./interfaces/IFactory.sol";
import {IProducerStorage} from "./interfaces/IProducerStorage.sol";

// todo research  Clones.sol or ClonesUpgradeable

contract Factory is Initializable, OwnableUpgradeable, DelegateCall, IFactory {
    address private uriGeneratorAddress;
    address private producerLogicAddress;
    address private producerApiAddress;
    address private producerNUsageAddress;
    address private producerVestingApiAddress;
    address ProducerImplementation;

    IProducerStorage public producerStorage;

    // @notice Event triggered when a new Bcontract is created
    // @param  "uint256 _producerId,  string _name, string _description, string _image,  string _externalLink,  address owner"
    event BcontractCreated(
        uint256 _producerId,
        string _name,
        string _description,
        string _image,
        string _externalLink,
        address owner
    );

    function initialize(
        address _uriGeneratorAddress,
        address _producerStorageAddress,
        address _producerApiAddress,
        address _producerNUsageAddress,
        address _producerVestingApiAddress
    ) external initializer onlyProxy {
        __Ownable_init();
        producerStorage = IProducerStorage(_producerStorageAddress);
        uriGeneratorAddress = _uriGeneratorAddress;
        producerApiAddress = _producerApiAddress;
        producerNUsageAddress = _producerNUsageAddress;
        producerVestingApiAddress = _producerVestingApiAddress;

        ProducerImplementation = address(new Producer());
    }

    /**
     * @notice returns the Bcontract contract implementation
     */
    function getProducerImplementation() external view returns (address) {
        return ProducerImplementation;
    }

    /**
     * @notice Allows the owner update the Bcontract contract implementation for future Bcontract created
     */
    function setProducerImplementation(
        address _ProducerImplementationAddress
    ) external onlyOwner onlyProxy {
        require(Address.isContract(_ProducerImplementationAddress));
        ProducerImplementation = _ProducerImplementationAddress;
    }

    /**
     * @notice returns the uriGenerator contract address
     *
     */

    function newBcontract(DataTypes.Producer calldata vars) external {
        require(
            !producerStorage.exsistProducer(msg.sender),
            "producer already existing!"
        );
        //Clones the   contract implementation
        address clone = Clones.clone(ProducerImplementation);
        //calls Bcontractv2.initialize
        Producer b = Producer(clone);
        incrementPR_ID();
        producerStorage.SetCloneId(currentPR_ID(), clone);

        DataTypes.Producer memory producer;
        producer.producerId = currentPR_ID();
        producer.cloneAddress = payable(clone);
        producer.exists = true;
        producer.name = vars.name;
        producer.description = vars.description;
        producer.image = vars.image;
        producer.externalLink = vars.externalLink;
        producer.producerAddress = payable(msg.sender);

        producerStorage.addProducer(producer);
        b.initialize(
            payable(msg.sender),
            uriGeneratorAddress,
            producerApiAddress,
            producerNUsageAddress,
            producerVestingApiAddress,
            address(producerStorage)
        );
        emit BcontractCreated(
            currentPR_ID(),
            vars.name,
            vars.description,
            vars.image,
            vars.externalLink,
            payable(msg.sender)
        );
    }

    /* @notice returns the Bcontract contract address
       @param proAddress the address of the Bcontract
         @return the producerAddressInfo      
*/
    function getProducerInfo(
        address proAddress
    ) public view returns (DataTypes.Producer memory info) {
        info = producerStorage.getProducer(proAddress);
        return info;
    }

    function currentPR_ID() public view returns (uint256) {
        return producerStorage.currentPR_ID();
    }

    function incrementPR_ID() public returns (uint256) {
        producerStorage.incrementPR_ID();
        return producerStorage.currentPR_ID();
    }

    function getClones() external view returns (address[] memory) {
        return producerStorage.getClones(currentPR_ID());
    }
}
