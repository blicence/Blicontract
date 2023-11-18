// SPDX-License-Identifier: AGPLv3
pragma solidity ^0.8.0;

/// @title Abstract Storage Contract to pad the first 32 slots of storage
/// @author Superfluid
/// @dev MUST be the FIRST contract inherited to pad the first 32 slots. The slots are padded to
/// ensure the implementation contract (SuperToken.sol) does not override any auxiliary state
/// variables. For more info see `./docs/StorageLayout.md`.
abstract contract SuperTokenStorage {
    uint256[32] internal _storagePaddings;
}

import {Proxy} from "@openzeppelin/contracts/proxy/Proxy.sol";

/// @title UUPS Proxy implementation contract
/// @author jtriley.eth
/// @notice Stores the logic contract's address at the _IMPLEMENTATION_SLOT
/// @dev `initializeProxy(address)` is called by the Super Token Factory
/// The call to the factory should be in the same transaction to avoid being
/// front run
contract UUPSProxy is Proxy {
	/// @notice Thrown when the logic contract address is zero
	error ZeroAddress();

	/// @notice Thrown when the logic contract has been set
	error Initialized();

	/// @notice Precomputed from the following for gas savings
	/// bytes32(uint256(keccak256("eip1967.proxy.implementation") - 1));
	bytes32 internal constant _IMPLEMENTATION_SLOT =
		0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

	/// @notice Stores the logic contract address only once.
	/// @dev Called by the SuperTokenFactory contract on upgrade
	/// @param initialAddress logic contract address
	function initializeProxy(address initialAddress) external {
		if (initialAddress == address(0)) revert ZeroAddress();
		if (_implementation() != address(0)) revert Initialized();
		assembly {
			sstore(_IMPLEMENTATION_SLOT, initialAddress)
		}
	}

	/// @notice Reads logic contract from precomputed slot
	/// @return impl Logic contract address
	function _implementation()
		internal
		view
		virtual
		override
		returns (address impl)
	{
		assembly {
			impl := sload(_IMPLEMENTATION_SLOT)
		}
	}
}

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISuperToken} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperToken.sol";
import {ISuperTokenFactory} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperTokenFactory.sol";

/// @title Abstract contract containing a thin layer of abstraction for aux logic.
/// @author jtriley.eth
/// @dev The initial supply may be zero, in the event the token is mintable.
/// Inheriting contracts MUST have an initializer calling this function!
abstract contract SuperTokenBase is SuperTokenStorage, UUPSProxy {

	/// @dev Upgrades the super token with the factory, then initializes.
	/// @param factory super token factory for initialization
	/// @param name super token name
	/// @param symbol super token symbol
	function _initialize(address factory, string memory name, string memory symbol) internal {
		ISuperTokenFactory(factory).initializeCustomSuperToken(address(this));
		ISuperToken(address(this)).initialize(IERC20(address(0)), 18, name, symbol);
	}

	/// @dev Gets totalSupply
	/// @return t total supply
	function _totalSupply() internal view returns (uint256 t) {
		return ISuperToken(address(this)).totalSupply();
	}

	/// @dev Internal mint, calling functions should perform important checks!
	/// @param account Address receiving minted tokens
	/// @param amount Amount of tokens minted
	/// @param userData Optional user data for ERC777 send callback
	function _mint(address account, uint256 amount, bytes memory userData) internal {
		ISuperToken(address(this)).selfMint(account, amount, userData);
	}

	/// @dev Internal burn, calling functions should perform important checks!
	/// @param from Address from which to burn tokens
	/// @param amount Amount to burn
	/// @param userData Optional user data for ERC777 send callback
	function _burn(address from, uint256 amount, bytes memory userData) internal {
		ISuperToken(address(this)).selfBurn(from, amount, userData);
	}

	/// @dev Internal approve, calling functions should perform important checks!
	/// @param account Address of approving party
	/// @param spender Address of spending party
	/// @param amount Approval amount
	function _approve(address account, address spender, uint256 amount) internal {
		ISuperToken(address(this)).selfApproveFor(account, spender, amount);
	}

	/// @dev Internal transferFrom, calling functions should perform important checks!
	/// @param holder Owner of the tranfserred tokens
	/// @param spender Address of spending party (approved/operator)
	/// @param recipient Address of recipient party
	/// @param amount Amount to be tranfserred
	function _transferFrom(
		address holder,
		address spender,
		address recipient,
		uint256 amount
	) internal {
		ISuperToken(address(this)).selfTransferFrom(holder, spender, recipient, amount);
	}
}