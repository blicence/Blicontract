// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/**
 * @title ProducerStorageErrors
 * @dev Custom errors for ProducerStorage contract to reduce bytecode size
 */
library ProducerStorageErrors {
    /// @dev Only factory can call this function
    error OnlyFactory();
    
    /// @dev Only producer can call this function  
    error OnlyProducer();
    
    /// @dev Only registered producer can call this function
    error OnlyRegisteredProducer();
    
    /// @dev Only producer API can call this function
    error OnlyProducerApi();
    
    /// @dev Only producer NUsage can call this function
    error OnlyProducerNUsage();
    
    /// @dev Only producer vesting API can call this function
    error OnlyProducerVestingApi();
    
    /// @dev Customer plan does not exist
    error CustomerPlanNotExist();
    
    /// @dev Plan already exists
    error PlanAlreadyExists();
    
    /// @dev Not enough remaining quota
    error InsufficientQuota();
    
    /// @dev Producer not registered
    error ProducerNotRegistered();
    
    /// @dev Only existing producer can call this function
    error OnlyExistingProducer();
    
    /// @dev Only non-existing producer can call this function
    error OnlyNonExistingProducer();
}
