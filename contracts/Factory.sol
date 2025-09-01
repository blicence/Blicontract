// SPDX-License-Identifier: MIT

pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./Producer.sol";
import {DataTypes} from "./libraries/DataTypes.sol";
import {IFactory} from "./interfaces/IFactory.sol";
import {IProducerStorage} from "./interfaces/IProducerStorage.sol";
import {IStreamLockManager} from "./interfaces/IStreamLockManager.sol";
import {FactoryErrors} from "./errors/FactoryErrors.sol";

// todo research  Clones.sol or ClonesUpgradeable

contract Factory is Initializable, OwnableUpgradeable, UUPSUpgradeable, IFactory {
    // Pack addresses into struct to optimize storage
    struct Addresses {
        address uriGenerator;
        address producerApi; 
        address producerNUsage;
        address producerVestingApi;
        address producerImplementation;
    }
    
    Addresses private addresses;
    IProducerStorage public producerStorage;
    IStreamLockManager public streamLockManager;

    // @notice Event for new Bcontract creation
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
        address _streamLockManagerAddress,
        address _producerImplementation
    ) external initializer onlyProxy {
        __Ownable_init(msg.sender);
        producerStorage = IProducerStorage(_producerStorageAddress);
        streamLockManager = IStreamLockManager(_streamLockManagerAddress);
        
        addresses.uriGenerator = _uriGeneratorAddress;
        addresses.producerApi = _producerApiAddress;
        addresses.producerNUsage = _producerNUsageAddress;
        addresses.producerVestingApi = _producerVestingApiAddress;
        addresses.producerImplementation = _producerImplementation;
    }

    /**
     * @notice returns the Bcontract contract implementation
     */
    function getProducerImplementation() external view returns (address) {
        return addresses.producerImplementation;
    }

    function setProducerImplementation(
        address _ProducerImplementationAddress
    ) external onlyOwner onlyProxy {
        if (_ProducerImplementationAddress.code.length == 0) revert FactoryErrors.NotAContract();
        addresses.producerImplementation = _ProducerImplementationAddress;
    }

    function newBcontract(DataTypes.Producer calldata vars) external {
        if (producerStorage.exsistProducerClone(msg.sender)) revert FactoryErrors.ProducerAlreadyExists();
        
        address clone = Clones.clone(addresses.producerImplementation);
        
        incrementPR_ID();
        uint256 producerId = currentPR_ID();
        producerStorage.SetCloneId(producerId, clone);

        producerStorage.addProducer(DataTypes.Producer({
            producerId: producerId,
            cloneAddress: payable(clone),
            exists: true,
            name: vars.name,
            description: vars.description,
            image: vars.image,
            externalLink: vars.externalLink,
            producerAddress: payable(msg.sender)
        }));
        
        // Direct call to initialize function using interface
        bytes memory initData = abi.encodeCall(
            Producer(clone).initialize,
            (
                payable(msg.sender),
                addresses.uriGenerator,
                addresses.producerNUsage,
                address(producerStorage),
                address(streamLockManager)
            )
        );
        
        (bool success, bytes memory returnData) = clone.call(initData);
        if (!success) {
            if (returnData.length > 0) {
                assembly {
                    let returnDataSize := mload(returnData)
                    revert(add(32, returnData), returnDataSize)
                }
            } else {
                revert FactoryErrors.InitializationFailed();
            }
        }
        
        emit BcontractCreated(
            producerId,
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

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
