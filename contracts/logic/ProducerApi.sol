// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Base64} from "./../libraries/Base64.sol";
import {DataTypes} from "./../libraries/DataTypes.sol";
import {IProducerStorage} from "./../interfaces/IProducerStorage.sol";
import {IStreamLockManager} from "./../interfaces/IStreamLockManager.sol";
import "../DelegateCall.sol";

/**
 * @title ProducerApi
 * @dev Logic contract for API subscription plans with streaming payments
 * @notice Handles API plan creation, subscription management, and stream-based billing
 */
contract ProducerApi is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    DelegateCall
{
    IProducerStorage public producerStorage;
    IStreamLockManager public streamLockManager;

    event PlanInfoApiAdded(
        uint256 indexed planId,
        uint256 flowRate,
        uint256 perMonthLimit
    );

    event ApiUsageValidated(
        uint256 indexed customerPlanId,
        address indexed customer,
        uint256 usageAmount,
        uint256 remainingQuota
    );

    event StreamSubscriptionCreated(
        uint256 indexed planId,
        uint256 indexed customerPlanId,
        address indexed customer,
        bytes32 streamId,
        uint256 duration
    );

    function initialize() external initializer onlyProxy {
        __Ownable_init(msg.sender);
    }

    /**
     * @dev Function required by UUPS proxy pattern
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    modifier onlyProducer(address _cloneAddress) {
        require(
            producerStorage.getProducer(_cloneAddress).cloneAddress == msg.sender,
            "Only producer contract can call this function"
        );
        _;
    }

    modifier onlyRightProducer(uint256 _producerId, address cloneAddress) {
        require(
            producerStorage.getCloneId(_producerId) == cloneAddress,
            "Right producer contract can call this function"
        );
        _;
    }

    function setProducerStorage(address _producerStorage) external onlyOwner {
        producerStorage = IProducerStorage(_producerStorage);
    }

    function setStreamLockManager(address _streamLockManager) external onlyOwner {
        streamLockManager = IStreamLockManager(_streamLockManager);
    }

    /**
     * @dev Add API plan information after base plan creation
     * @param _planInfoApi API plan specific information
     */
    function addPlanInfoApi(
        DataTypes.PlanInfoApi memory _planInfoApi
    ) external onlyProducer(msg.sender) {
        // Validate plan exists and is API type
        DataTypes.Plan memory plan = producerStorage.getPlan(_planInfoApi.planId);
        require(plan.planType == DataTypes.PlanTypes.api, "Plan must be API type");
        
        // Store API plan info
        producerStorage.setPlanInfoApi(_planInfoApi.planId, _planInfoApi);
        
        emit PlanInfoApiAdded(
            _planInfoApi.planId,
            _planInfoApi.flowRate,
            _planInfoApi.perMonthLimit
        );
    }

    /**
     * @dev Validate API usage for a customer plan
     * @param _customerPlanId Customer plan ID
     * @param _usageAmount Amount of API calls to validate
     * @return success Whether usage is valid
     */
    function validateApiUsage(
        uint256 _customerPlanId,
        uint256 _usageAmount
    ) public view returns (bool success) {
        DataTypes.CustomerPlan memory customerPlan = producerStorage.getCustomerPlan(_customerPlanId);
        
        // Check if customer plan is active
        require(customerPlan.status == DataTypes.Status.active, "Customer plan not active");
        
        // Check remaining quota
        require(customerPlan.remainingQuota >= _usageAmount, "Insufficient quota");
        
        // Get API plan info for additional validations
        DataTypes.PlanInfoApi memory apiInfo = producerStorage.getPlanInfoApi(customerPlan.planId);
        
        // Check monthly limits (simplified - would need more complex time tracking)
        require(_usageAmount <= apiInfo.perMonthLimit, "Exceeds monthly limit");
        
        return true;
    }

    /**
     * @dev Process API usage and update customer plan quota
     * @param _customerPlanId Customer plan ID
     * @param _usageAmount Amount of API calls used
     */
    function processApiUsage(
        uint256 _customerPlanId,
        uint256 _usageAmount
    ) external onlyProducer(msg.sender) {
        DataTypes.CustomerPlan memory customerPlan = producerStorage.getCustomerPlan(_customerPlanId);
        
        // Validate usage
        require(validateApiUsage(_customerPlanId, _usageAmount), "Invalid usage");
        
        // Update remaining quota
        customerPlan.remainingQuota -= _usageAmount;
        producerStorage.setCustomerPlan(_customerPlanId, customerPlan);
        
        emit ApiUsageValidated(
            _customerPlanId,
            customerPlan.customerAdress,
            _usageAmount,
            customerPlan.remainingQuota
        );
    }

    /**
     * @dev Get API plan information
     * @param _planId Plan ID
     * @return apiInfo API plan information
     */
    function getPlanInfoApi(
        uint256 _planId
    ) external view returns (DataTypes.PlanInfoApi memory apiInfo) {
        return producerStorage.getPlanInfoApi(_planId);
    }

    /**
     * @dev Calculate API subscription cost based on flow rate
     * @param _planId Plan ID
     * @param _duration Subscription duration in seconds
     * @return cost Total cost for the duration
     */
    function calculateApiCost(
        uint256 _planId,
        uint256 _duration
    ) external view returns (uint256 cost) {
        DataTypes.PlanInfoApi memory apiInfo = producerStorage.getPlanInfoApi(_planId);
        return apiInfo.flowRate * _duration;
    }

    // ============ STREAM LOCK MANAGER INTEGRATION ============

    /**
     * @dev Subscribe to API plan using StreamLockManager
     * @param _planId Plan ID to subscribe to
     * @param _duration Subscription duration in seconds
     * @return streamId Created stream ID
     * @return customerPlanId Created customer plan ID
     */
    function subscribeWithStream(
        uint256 _planId,
        uint256 _duration
    ) external returns (bytes32 streamId, uint256 customerPlanId) {
        require(address(streamLockManager) != address(0), "StreamLockManager not set");
        
        // Get plan information
        DataTypes.Plan memory plan = producerStorage.getPlan(_planId);
        DataTypes.PlanInfoApi memory apiInfo = producerStorage.getPlanInfoApi(_planId);
        
        require(plan.planType == DataTypes.PlanTypes.api, "Plan must be API type");
        require(plan.status == DataTypes.Status.active, "Plan not active");
        
        // Calculate total amount needed
        uint256 totalAmount = apiInfo.flowRate * _duration;
        require(totalAmount > 0, "Invalid duration or flow rate");
        
        // Create customer plan first
        customerPlanId = _createCustomerPlan(_planId, msg.sender, totalAmount);
        
        // Create stream lock
        streamId = streamLockManager.createStreamLock(
            plan.cloneAddress,     // recipient (producer)
            plan.priceAddress,     // payment token
            totalAmount,           // total amount
            _duration              // duration
        );
        
        // Link stream to customer plan
        streamLockManager.linkStreamToCustomerPlan(customerPlanId, streamId);
        
        emit StreamSubscriptionCreated(_planId, customerPlanId, msg.sender, streamId, _duration);
        
        return (streamId, customerPlanId);
    }

    /**
     * @dev Validate API usage and update stream if necessary
     * @param _customerPlanId Customer plan ID
     * @param _usageAmount Amount of usage
     * @return success True if usage is valid and stream updated
     */
    function validateStreamApiUsage(
        uint256 _customerPlanId,
        uint256 _usageAmount
    ) external returns (bool success) {
        require(address(streamLockManager) != address(0), "StreamLockManager not set");
        
        // Get linked stream
        bytes32 streamId = streamLockManager.getCustomerPlanStream(_customerPlanId);
        require(streamId != bytes32(0), "No stream linked to customer plan");
        
        // Update stream on usage (this will track usage for potential settlement)
        success = streamLockManager.updateStreamOnUsage(streamId, _usageAmount);
        
        if (success) {
            // Get customer plan and validate traditional way as well
            DataTypes.CustomerPlan memory customerPlan = producerStorage.getCustomerPlan(_customerPlanId);
            
            // Update remaining quota (traditional validation)
            if (customerPlan.remainingQuota >= _usageAmount) {
                // Update customer plan in storage
                customerPlan.remainingQuota -= _usageAmount;
                producerStorage.setCustomerPlan(_customerPlanId, customerPlan);
                
                emit ApiUsageValidated(_customerPlanId, customerPlan.customerAdress, _usageAmount, customerPlan.remainingQuota);
            }
        }
        
        return success;
    }

    /**
     * @dev Internal function to create customer plan for stream subscription
     */
    function _createCustomerPlan(
        uint256 _planId,
        address _customer,
        uint256 _totalAmount
    ) internal returns (uint256 customerPlanId) {
        DataTypes.Plan memory plan = producerStorage.getPlan(_planId);
        DataTypes.PlanInfoApi memory apiInfo = producerStorage.getPlanInfoApi(_planId);
        
        // Calculate quota based on total amount and flow rate
        uint256 quota = _totalAmount / apiInfo.flowRate; // This gives us time-based quota
        
        DataTypes.CustomerPlan memory customerPlan = DataTypes.CustomerPlan({
            customerAdress: _customer,
            planId: _planId,
            custumerPlanId: 0, // Will be set by storage
            producerId: 0, // Will be set by storage
            cloneAddress: address(this),
            priceAddress: address(0), // Will be set from plan info
            startDate: uint32(block.timestamp),
            endDate: uint32(block.timestamp + (_totalAmount / apiInfo.flowRate)),
            remainingQuota: quota,
            status: DataTypes.Status.active,
            planType: DataTypes.PlanTypes.api,
            streamId: 0, // Initially no stream
            hasActiveStream: false // Initially no active stream
        });
        
        // Store customer plan
        producerStorage.addCustomerPlan(customerPlan);
        
        // Generate customer plan ID for return
        customerPlanId = uint256(keccak256(abi.encodePacked(_planId, _customer, address(this))));
        
        return customerPlanId;
    }
}
