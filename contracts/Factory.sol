// SPDX-License-Identifier: MIT

pragma solidity 0.8.30;

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
import {IStreamLockManager} from "./interfaces/IStreamLockManager.sol";

// todo research  Clones.sol or ClonesUpgradeable

contract Factory is Initializable, OwnableUpgradeable, DelegateCall, IFactory {
    address private uriGeneratorAddress;
    address private producerLogicAddress;
    address private producerApiAddress;
    address private producerNUsageAddress;
    address private producerVestingApiAddress;
    address ProducerImplementation;

    IProducerStorage public producerStorage;
    IStreamLockManager public streamLockManager;

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
        address _producerVestingApiAddress,
        address _streamLockManagerAddress
    ) external initializer onlyProxy {
        __Ownable_init(msg.sender);
        producerStorage = IProducerStorage(_producerStorageAddress);
        streamLockManager = IStreamLockManager(_streamLockManagerAddress);
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
        require(_ProducerImplementationAddress.code.length > 0, "Not a contract");
        ProducerImplementation = _ProducerImplementationAddress;
    }

    /**
     * @notice returns the uriGenerator contract address
     *
     */

    function newBcontract(DataTypes.Producer calldata vars) external {
        require(
            !producerStorage.exsistProducerClone(msg.sender),
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
            producerNUsageAddress,
            address(producerStorage),
            address(streamLockManager)
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
     

    function currentPR_ID() public view returns (uint256) {
        return producerStorage.currentPR_ID();
    }

    function incrementPR_ID() public returns (uint256) {
        producerStorage.incrementPR_ID();
        return producerStorage.currentPR_ID();
    }

  
}
