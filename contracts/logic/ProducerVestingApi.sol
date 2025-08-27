// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;
 
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DataTypes} from "./../libraries/DataTypes.sol";
import {Base64} from "./../libraries/Base64.sol"; 
import "./../interfaces/IVestingScheduler.sol";
import "./../interfaces/IProducerVestingApi.sol";
import {IProducerStorage} from "./../interfaces/IProducerStorage.sol";
import {IStreamLockManager} from "./../interfaces/IStreamLockManager.sol";

contract ProducerVestingApi is
    IProducerVestingApi,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
   
    IVestingScheduler private vestingScheduler;
    IProducerStorage public producerStorage;
    IStreamLockManager public streamLockManager;

    function initialize() external initializer onlyProxy {
        __Ownable_init();
    }

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

    /**
     * Function required by UUPS proxy pattern
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

 
    function setSuperInitialize(
        IVestingScheduler _vestingScheduler,
        IStreamLockManager _streamLockManager
    ) external onlyOwner {
        vestingScheduler = IVestingScheduler(_vestingScheduler);
        streamLockManager = IStreamLockManager(_streamLockManager);
    }

    function setProducerStorage(address _producerStorage) external onlyOwner {
        producerStorage = IProducerStorage(_producerStorage);
    }

    // Stream-based vesting implementation
    // This function creates a vesting schedule using our own streaming system
    function createVestingSchedule(
        address token,
        address receiver,
        uint32 startDate,
        uint32 cliffDate,
        uint256 flowRate,
        uint256 startAmount,
        uint32 endDate,
        bytes memory ctx
    ) public {
        // Use our own streaming system instead of Superfluid
        streamLockManager.createStream(
            token,
            receiver,
            startDate,
            endDate,
            flowRate,
            startAmount
        );
        
        // Also create in vesting scheduler for tracking
        vestingScheduler.createVestingSchedule(
            token,
            receiver,
            startDate,
            cliffDate,
            flowRate,
            startAmount,
            endDate,
            ctx
        );
    }

    function getVestingSchedule(
        address token,
        address account,
        address receiver
    ) public view returns (IVestingScheduler.VestingSchedule memory) {
        return
            vestingScheduler.getVestingSchedule(
                token,
                account,
                receiver
            );
    }

    function updateVestingSchedule(
        address token,
        address receiver,
        uint32 endDate,
        bytes memory ctx
    ) public returns (bytes memory newCtx) {
        // Update our stream system
        streamLockManager.updateStream(token, receiver, endDate);
        
        // Update vesting scheduler
        newCtx = vestingScheduler.updateVestingSchedule(
            token,
            receiver,
            endDate,
            ctx
        );
    }

    function deleteVestingSchedule(
        address token,
        address receiver,
        bytes memory ctx
    ) public returns (bytes memory newCtx) {
        // Delete from our stream system
        streamLockManager.deleteStream(token, receiver);
        
        // Delete from vesting scheduler
        newCtx = vestingScheduler.deleteVestingSchedule(
            token,
            receiver,
            ctx
        );
    }

    function addCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    ) public onlyProducer(vars.cloneAddress) {
        DataTypes.PlanInfoVesting memory planInfoVesting = producerStorage
            .getPlanInfoVesting(vars.planId);

        createVestingSchedule(
            vars.priceAddress,
            vars.cloneAddress,
            vars.startDate,
            planInfoVesting.cliffDate,
            planInfoVesting.flowRate,
            planInfoVesting.startAmount,
            vars.endDate,
            ""
        );  

        producerStorage.addCustomerPlan(vars);
    }

    function updateCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    )
        public
        onlyProducer(vars.cloneAddress)
        OnlyRightProducer(vars.producerId, vars.cloneAddress)
    {
        deleteVestingSchedule(
            vars.priceAddress,
            vars.cloneAddress,
            ""
        );

        if (vars.status == DataTypes.Status.active) {
            updateVestingSchedule(
                vars.priceAddress,
                vars.cloneAddress,
                vars.endDate,
                ""
            );
        }
        producerStorage.updateCustomerPlan(vars);
    }

    function transferTokens(
        address token,
        address to,
        uint256 amount
    ) internal {
        // Direct ERC20 transfer instead of SuperToken wrapping
        IERC20(token).transfer(to, amount);
    }

    function transferTokensFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        // Direct ERC20 transferFrom instead of SuperToken operations
        IERC20(token).transferFrom(from, to, amount);
    }

}
