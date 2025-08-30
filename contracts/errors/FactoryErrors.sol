// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/**
 * @title FactoryErrors
 * @dev Custom errors for Factory contract to reduce bytecode size
 */
library FactoryErrors {
    /// @dev Address is not a contract
    error NotAContract();
    
    /// @dev Producer already exists
    error ProducerAlreadyExists();
}
