// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
/* import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol"; */
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
 
import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
import {ERC20 as SolmateERC20} from "./libraries/ERC20.sol";
import "./DelegateCall.sol";
import {DataTypes} from "./libraries/DataTypes.sol";
import "./storage/ProducerStorage.sol";
import "./interfaces/IURIGenerator.sol";
import "./interfaces/IProducerNUsage.sol";
import "./interfaces/IStreamLockManager.sol";

contract Producer is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    DelegateCall,
    PausableUpgradeable/* ,
    ERC1155Upgradeable */
{
    IURIGenerator public uriGenerator;
    IProducerStorage public producerStorage;
    IProducerNUsage public producerNUsage;
    IStreamLockManager public streamLockManager;

    // Mapping to store stream lock IDs for customer plans
    mapping(uint256 => bytes32) public customerPlanToStreamLock;
    mapping(bytes32 => uint256) public streamLockToCustomerPlan;

   event LogAddPlan(
        uint256 planId,
        address producerAddress,
        string name,
        DataTypes.PlanTypes planType
    );

    event CustomerPlanWithStreamCreated(
        uint256 indexed customerPlanId,
        bytes32 indexed streamLockId,
        address indexed customer
    );

    event StreamUsageValidated(
        uint256 indexed customerPlanId,
        bytes32 indexed streamLockId,
        address indexed customer,
        bool canUse
    );
    constructor() {
        _disableInitializers();
    }

    // initialize function for the contract initialize  the contract
    // the contract is initialized by the proxy contract
    // the proxy contract is initialized by the factory contract
    function initialize(
        address payable user,
        address _uriGeneratorAddress,
        address _producerNUsageAddress,
        address _producerStorageAddress,
        address _streamLockManagerAddress
    ) external initializer {
       /*  __ERC1155_init(""); */
        __Ownable_init(user);
        __Pausable_init();
        __ReentrancyGuard_init();

        uriGenerator = IURIGenerator(_uriGeneratorAddress);

        producerStorage = IProducerStorage(_producerStorageAddress);
        producerNUsage = IProducerNUsage(_producerNUsageAddress);
        streamLockManager = IStreamLockManager(_streamLockManagerAddress);

        _transferOwnership(user);
    }

    modifier onlyExistCustumer(
        uint256 planId,
        address customerAddress,
        address cloneAddress
    ) {
        require(
            producerStorage.exsitCustomerPlan(
                planId,
                customerAddress,
                cloneAddress
            ) == true,
            "Customer plan not exist"
        );
        _;
    }
modifier onlyCustomer(address   customerAddress) {
        require(
            producerStorage.getCustomer(address(customerAddress)).customer ==
                address(msg.sender),
            "only customer can call this function"
        );
        _;
    }

 
    // This function adds a new plan to the contract
    function addPlan(
        DataTypes.Plan calldata vars
    ) external onlyOwner   returns (uint256 planId) {
        // get the address of the producer adding the plan

       planId= producerStorage.addPlan(vars);
        emit LogAddPlan(planId, address(this), vars.name, vars.planType);
       return planId;
        
    }

    function addPlanInfoApi(DataTypes.PlanInfoApi calldata vars
    ) external onlyOwner
    {
        producerStorage.addPlanInfoApi(vars);
        
    }

    function addPlanInfoNUsage(DataTypes.PlanInfoNUsage calldata vars
    ) external onlyOwner
    {
        producerStorage.addPlanInfoNUsage(vars);
    }

    function addPlanInfoVesting(DataTypes.PlanInfoVesting calldata vars
    ) external onlyOwner
    {
        producerStorage.addPlanInfoVesting(vars);
    }

    // This function updates the plan object stored in the contract
    function setPlan(
        DataTypes.Plan calldata vars
    ) external onlyOwner {
        producerStorage.setPlan(vars);
    }

    // This function returns the producer object stored in the contract

    function getProducer() public view returns (DataTypes.Producer memory) {
        return producerStorage.getProducer(address(this));
    }


    // This function updates the producer object stored in the contract

    function setProducer(DataTypes.Producer calldata vars) external onlyOwner {
        producerStorage.setProducer(vars);
    }

    // This function returns the plan object with the given ID
    function getPlan(
        uint256 _planId
    ) public view returns (DataTypes.Plan memory plan) {
        return producerStorage.getPlan(_planId);
    }

    // This function returns all the prPlans stored in the contract
    function getPlans() public view returns (DataTypes.Plan[] memory) {
        address add = address(this);
        return producerStorage.getPlans(add);
    }

    // This function adds a new customer plan to the contract
    function addCustomerPlan(DataTypes.CustomerPlan memory vars) public    {
        bytes32 streamLockId; // Stream ID if created
        
        if (vars.planType == DataTypes.PlanTypes.nUsage) {
            
            DataTypes.PlanInfoNUsage memory pInfoNUsage= producerStorage.getPlanInfoNUsage(vars.planId);
            DataTypes.Plan memory plan= producerStorage.getPlan(vars.planId);
            require(vars.remainingQuota >0, "remainingQuota must be higher than zero!");
            require(SolmateERC20(address(plan.priceAddress)).balanceOf(msg.sender) >= pInfoNUsage.oneUsagePrice*vars.remainingQuota, "Amount must be higher than zero!");
        
            // Create stream lock for the customer plan
            uint256 totalAmount = pInfoNUsage.oneUsagePrice * vars.remainingQuota;
            uint256 streamDuration = _calculateStreamDuration(vars.planId, vars.remainingQuota);
            
            // Create stream through StreamLockManager
            streamLockId = _createCustomerPlanStream(
                vars.custumerPlanId,
                msg.sender,
                address(this),
                address(plan.priceAddress),
                totalAmount,
                streamDuration
            );
            
            producerNUsage.addCustomerPlan(vars);
 
        }
        uriGenerator.mint(vars);
        
        // Emit event with stream info if created
        if (streamLockId != bytes32(0)) {
            emit CustomerPlanWithStreamCreated(vars.custumerPlanId, streamLockId, msg.sender);
        }
    }

    function updateCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    ) public onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress) onlyCustomer(msg.sender) {
       
        if (vars.planType == DataTypes.PlanTypes.nUsage) {
            if(vars.status==DataTypes.Status.inactive){
                // return the remaining quota to the customer 
                 DataTypes.Plan memory plan= producerStorage.getPlan(vars.planId);
               uint256  custumerPlanId =producerStorage.getCustomerPlanId(vars.planId,msg.sender,vars.cloneAddress);

                   DataTypes.CustomerPlan memory cpnu= producerStorage.getCustomerPlan(custumerPlanId);
                    require(cpnu.remainingQuota >0, "remainingQuota must be higher than zero!");
                    DataTypes.PlanInfoNUsage memory pInfoNUsage= producerStorage.getPlanInfoNUsage(vars.planId);
                
                
                
                  SafeTransferLib.safeTransferFrom(SolmateERC20(address(plan.priceAddress)),address(this),msg.sender ,  (pInfoNUsage.oneUsagePrice)*cpnu.remainingQuota);
            }
            producerNUsage.updateCustomerPlan(vars);
        }
        if (vars.status == DataTypes.Status.inactive) {
           uriGenerator.burn(vars);
        } 
    }

    // ========== STREAM VALIDATION FUNCTIONS ==========

    /**
     * @dev Check stream status before service usage
     * @param customerPlanId Customer plan ID
     * @param customer Customer address
     */
    function checkStreamBeforeUsage(
        uint256 customerPlanId,
        address customer
    ) public returns (bool canUse) {
        // Get associated stream lock ID from mapping
        bytes32 streamLockId = customerPlanToStreamLock[customerPlanId];
        
        if (streamLockId != bytes32(0) && address(streamLockManager) != address(0)) {
            // Validate through StreamLockManager
            canUse = streamLockManager.checkAndSettleOnUsage(customer, streamLockId);
            
            emit StreamUsageValidated(customerPlanId, streamLockId, customer, canUse);
        } else {
            // No stream or manager, allow usage (backward compatibility)
            canUse = true;
        }
        
        return canUse;
    }

    /**
     * @dev Get stream lock ID for customer plan
     * @param customerPlanId Customer plan ID
     * @return streamLockId Associated stream lock ID
     */
    function getStreamLockIdForCustomerPlan(uint256 customerPlanId) external view returns (bytes32 streamLockId) {
        return customerPlanToStreamLock[customerPlanId];
    }

    /**
     * @dev Get customer plan ID for stream lock
     * @param streamLockId Stream lock ID
     * @return customerPlanId Associated customer plan ID
     */
    function getCustomerPlanIdForStreamLock(bytes32 streamLockId) external view returns (uint256 customerPlanId) {
        return streamLockToCustomerPlan[streamLockId];
    }

   function useFromQuota(
        DataTypes.CustomerPlan calldata vars
    )
        public onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress) onlyCustomer(msg.sender) 
      
        returns (uint256)
    {
        // Validate stream access before usage
        bool canUse = checkStreamBeforeUsage(vars.custumerPlanId, msg.sender);
        require(canUse, "Stream validation failed");
        
        if (vars.planType == DataTypes.PlanTypes.nUsage) {
            return  producerNUsage.useFromQuota(vars);
        }
        return 0;
    }
    function uri(
        uint256 tokenId
    ) public view   returns (string memory) {
      

        return uriGenerator.uri(tokenId);
    }

    function getCustomer(
        address adr
    ) public view returns (DataTypes.Customer memory) {
        return producerStorage.getCustomer(adr);
    }

    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);
    }

    function withdrawTokens(SolmateERC20 token) public onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(msg.sender, balance);
    }

    // ========== STREAM INTEGRATION FUNCTIONS ==========

    /**
     * @dev Calculate stream duration based on plan configuration
     * @param planId Plan ID
     * @param quota Usage quota
     * @return duration Stream duration in seconds
     */
    function _calculateStreamDuration(uint256 planId, uint256 quota) internal view returns (uint256 duration) {
        DataTypes.Plan memory plan = producerStorage.getPlan(planId);
        
        // Default stream duration logic based on plan type
        if (plan.planType == DataTypes.PlanTypes.nUsage) {
            // For nUsage plans, calculate based on expected usage rate
            // Example: If quota is for 30 days of usage, stream for 30 days
            duration = 30 days; // Default 30 days
            
            // Adjust based on quota size
            if (quota <= 10) {
                duration = 7 days;   // Small quota: 1 week
            } else if (quota <= 100) {
                duration = 30 days;  // Medium quota: 1 month
            } else {
                duration = 90 days;  // Large quota: 3 months
            }
        } else {
            duration = 30 days; // Default duration for other plan types
        }
        
        return duration;
    }

    /**
     * @dev Create stream for customer plan
     * @param customerPlanId Customer plan ID
     * @param customer Customer address
     * @param producer Producer address (this contract)
     * @param token Token address
     * @param totalAmount Total amount to stream
     * @param duration Stream duration
     * @return lockId Created stream lock ID
     */
    function _createCustomerPlanStream(
        uint256 customerPlanId,
        address customer,
        address producer,
        address token,
        uint256 totalAmount,
        uint256 duration
    ) internal returns (bytes32 lockId) {
        // Only create stream if StreamLockManager is available
        if (address(streamLockManager) != address(0)) {
            try streamLockManager.createStreamForCustomerPlan(
                customerPlanId,
                customer,
                producer,
                token,
                totalAmount,
                duration
            ) returns (bytes32 streamId) {
                lockId = streamId;
            } catch {
                // If stream creation fails, continue without stream
                // This ensures backward compatibility
                lockId = bytes32(0);
            }
        }
        
        return lockId;
    }

    /**
     * @dev Validate stream access for service usage
     * @param customerPlanId Customer plan ID
     * @param customer Customer address
     * @return canUse Whether customer can use the service
     * @return streamLockId Associated stream lock ID
     */
    function validateStreamAccess(
        uint256 customerPlanId,
        address customer
    ) external pure returns (bool canUse, bytes32 streamLockId) {
        // For backward compatibility only - use validateUsageWithStream instead
        customerPlanId; // Silence unused parameter warning
        customer; // Silence unused parameter warning
        canUse = true;
        streamLockId = bytes32(0);
    }

    /**
     * @dev Set StreamLockManager address (for upgrades)
     * @param _streamLockManager New StreamLockManager address
     */
    function setStreamLockManager(address _streamLockManager) external onlyOwner {
        streamLockManager = IStreamLockManager(_streamLockManager);
    }

    /**
     * @dev Enhanced customer plan creation with explicit stream configuration
     * @param vars Customer plan data
     * @param streamDuration Duration for the stream in seconds (0 = no stream)
     * @return custumerPlanId The created customer plan ID
     * @return streamLockId The created stream lock ID (bytes32(0) if no stream)
     */
    function addCustomerPlanWithStream(
        DataTypes.CustomerPlan memory vars,
        uint256 streamDuration
    ) external returns (uint256 custumerPlanId, bytes32 streamLockId) {
        
        // Validate plan exists and is active
        DataTypes.Plan memory plan = producerStorage.getPlan(vars.planId);
        require(plan.status == DataTypes.Status.active, "Plan is not active");
        
        // Generate unique customer plan ID
        custumerPlanId = _generateCustomerPlanId(vars.planId, msg.sender);
        vars.custumerPlanId = custumerPlanId;
        
        if (vars.planType == DataTypes.PlanTypes.nUsage) {
            DataTypes.PlanInfoNUsage memory pInfoNUsage = producerStorage.getPlanInfoNUsage(vars.planId);
            
            require(vars.remainingQuota > 0, "Remaining quota must be higher than zero");
            
            uint256 totalAmount = pInfoNUsage.oneUsagePrice * vars.remainingQuota;
            require(
                SolmateERC20(address(plan.priceAddress)).balanceOf(msg.sender) >= totalAmount,
                "Insufficient token balance"
            );
            
            // Create stream if duration is specified and StreamLockManager is available
            if (streamDuration > 0 && address(streamLockManager) != address(0)) {
                try streamLockManager.createStreamForCustomerPlan(
                    custumerPlanId,
                    msg.sender,
                    address(this),
                    address(plan.priceAddress),
                    totalAmount,
                    streamDuration
                ) returns (bytes32 lockId) {
                    streamLockId = lockId;
                    
                    // Store mapping between customer plan and stream
                    customerPlanToStreamLock[custumerPlanId] = streamLockId;
                    streamLockToCustomerPlan[streamLockId] = custumerPlanId;
                    
                    emit CustomerPlanWithStreamCreated(custumerPlanId, streamLockId, msg.sender);
                } catch {
                    // If stream creation fails, proceed without stream
                    streamLockId = bytes32(0);
                }
            }
            
            // Add customer plan through NUsage logic
            producerNUsage.addCustomerPlan(vars);
        } else if (vars.planType == DataTypes.PlanTypes.api) {
            DataTypes.PlanInfoApi memory pInfoApi = producerStorage.getPlanInfoApi(vars.planId);
            
            // For API plans, create stream for monthly payment
            if (streamDuration > 0 && address(streamLockManager) != address(0)) {
                // Calculate total amount for the stream duration
                uint256 totalAmount = uint256(int256(pInfoApi.flowRate)) * streamDuration; // flowRate * seconds
                
                require(
                    SolmateERC20(address(plan.priceAddress)).balanceOf(msg.sender) >= totalAmount,
                    "Insufficient token balance for API plan"
                );
                
                try streamLockManager.createStreamForCustomerPlan(
                    custumerPlanId,
                    msg.sender,
                    address(this),
                    address(plan.priceAddress),
                    totalAmount,
                    streamDuration
                ) returns (bytes32 lockId) {
                    streamLockId = lockId;
                    
                    // Store mapping between customer plan and stream
                    customerPlanToStreamLock[custumerPlanId] = streamLockId;
                    streamLockToCustomerPlan[streamLockId] = custumerPlanId;
                    
                    emit CustomerPlanWithStreamCreated(custumerPlanId, streamLockId, msg.sender);
                } catch {
                    // If stream creation fails, proceed without stream
                    streamLockId = bytes32(0);
                }
            }
            
            // Set unlimited quota for API plans
            vars.remainingQuota = type(uint256).max;
            vars.endDate = uint32(block.timestamp + streamDuration);
            
            // Add customer plan through storage
            producerStorage.addCustomerPlan(vars);
            
        } else if (vars.planType == DataTypes.PlanTypes.vestingApi) {
            DataTypes.PlanInfoVesting memory pInfoVesting = producerStorage.getPlanInfoVesting(vars.planId);
            
            // For vesting plans, handle cliff amount and streaming
            require(pInfoVesting.cliffDate > block.timestamp, "Cliff date must be in the future");
            
            // Calculate total vesting amount (cliff + stream)
            uint256 streamAmount = uint256(int256(pInfoVesting.flowRate)) * streamDuration;
            uint256 totalAmount = pInfoVesting.startAmount + streamAmount;
            
            require(
                SolmateERC20(address(plan.priceAddress)).balanceOf(msg.sender) >= totalAmount,
                "Insufficient token balance for vesting plan"
            );
            
            // Create stream for the vesting portion (after cliff)
            if (streamDuration > 0 && address(streamLockManager) != address(0)) {
                try streamLockManager.createStreamForCustomerPlan(
                    custumerPlanId,
                    msg.sender,
                    address(this),
                    address(plan.priceAddress),
                    totalAmount,
                    streamDuration
                ) returns (bytes32 lockId) {
                    streamLockId = lockId;
                    
                    // Store mapping between customer plan and stream
                    customerPlanToStreamLock[custumerPlanId] = streamLockId;
                    streamLockToCustomerPlan[streamLockId] = custumerPlanId;
                    
                    emit CustomerPlanWithStreamCreated(custumerPlanId, streamLockId, msg.sender);
                } catch {
                    // If stream creation fails, proceed without stream
                    streamLockId = bytes32(0);
                }
            }
            
            // Set plan end date based on cliff + stream duration
            vars.remainingQuota = type(uint256).max; // Unlimited for vesting
            vars.endDate = uint32(pInfoVesting.cliffDate + streamDuration);
            
            // Add customer plan through storage
            producerStorage.addCustomerPlan(vars);
        }
        
        // Mint NFT representing the subscription
        uriGenerator.mint(vars);
        
        return (custumerPlanId, streamLockId);
    }

    /**
     * @dev Validate if customer can use service based on stream status
     * @param customerPlanId Customer plan ID
     * @return canUse Whether customer can use the service
     * @return remainingTime Time remaining in stream (0 if unlimited or no stream)
     * @return streamLockId Associated stream lock ID
     */
    function validateUsageWithStream(
        uint256 customerPlanId
    ) external view returns (bool canUse, uint256 remainingTime, bytes32 streamLockId) {
        
        // First check if customer plan exists and is active
        DataTypes.CustomerPlan memory customerPlan = producerStorage.getCustomerPlan(customerPlanId);
        
        if (customerPlan.status != DataTypes.Status.active) {
            return (false, 0, bytes32(0));
        }
        
        // Get associated stream lock ID from mapping
        streamLockId = customerPlanToStreamLock[customerPlanId];
        
        // If no stream, check traditional quota/expiry logic
        if (streamLockId == bytes32(0) || address(streamLockManager) == address(0)) {
            bool hasQuota = (customerPlan.remainingQuota > 0 || customerPlan.remainingQuota == type(uint256).max);
            bool notExpired = (customerPlan.endDate == 0 || block.timestamp <= customerPlan.endDate);
            return (hasQuota && notExpired, customerPlan.endDate > block.timestamp ? customerPlan.endDate - block.timestamp : 0, streamLockId);
        }
        
        // Check stream status
        try streamLockManager.getStreamStatus(streamLockId) returns (
            bool isActive,
            bool isExpired,
            uint256 accruedAmount,
            uint256, // remainingAmount - unused
            uint256 streamRemainingTime
        ) {
            // Stream is valid if active and not expired
            canUse = isActive && !isExpired && accruedAmount > 0;
            remainingTime = streamRemainingTime;
        } catch {
            // If stream check fails, fall back to traditional validation
            bool hasQuota = customerPlan.remainingQuota > 0;
            bool notExpired = (customerPlan.endDate == 0 || block.timestamp <= customerPlan.endDate);
            canUse = hasQuota && notExpired;
            remainingTime = customerPlan.endDate > block.timestamp ? customerPlan.endDate - block.timestamp : 0;
        }
        
        return (canUse, remainingTime, streamLockId);
    }

    /**
     * @dev Settle stream and update customer plan on service usage
     * @param customerPlanId Customer plan ID
     * @param usageAmount Amount of usage to deduct
     * @return success Whether settlement was successful
     */
    function settleStreamOnUsage(
        uint256 customerPlanId,
        uint256 usageAmount
    ) external returns (bool success) {
        
        DataTypes.CustomerPlan memory customerPlan = producerStorage.getCustomerPlan(customerPlanId);
        require(customerPlan.status == DataTypes.Status.active, "Customer plan not active");
        
        // Get associated stream lock ID from mapping
        bytes32 streamLockId = customerPlanToStreamLock[customerPlanId];
        
        if (streamLockId != bytes32(0) && address(streamLockManager) != address(0)) {
            // Try to update stream on usage
            try streamLockManager.updateStreamOnUsage(streamLockId, usageAmount) {
                emit StreamUsageValidated(customerPlanId, streamLockId, msg.sender, true);
            } catch {
                // Stream update failed, proceed with traditional logic
                emit StreamUsageValidated(customerPlanId, streamLockId, msg.sender, false);
            }
        }
        
        // Update customer plan usage if it's nUsage type
        if (customerPlan.planType == DataTypes.PlanTypes.nUsage) {
            require(customerPlan.remainingQuota >= usageAmount, "Insufficient quota");
            
            // Update the customer plan
            customerPlan.remainingQuota -= usageAmount;
            
            // Update in storage
            producerStorage.updateCustomerPlan(customerPlan);
        }
        
        return true;
    }

    /**
     * @dev Generate unique customer plan ID
     * @param planId Plan ID
     * @param customer Customer address
     * @return Unique customer plan ID
     */
    function _generateCustomerPlanId(uint256 planId, address customer) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(planId, customer, address(this), block.timestamp)));
    }

    /**
     * @dev Get StreamLockManager address
     * @return StreamLockManager contract address
     */
    function getStreamLockManager() external view returns (address) {
        return address(streamLockManager);
    }

    /**
     * Function required by UUPS proxy pattern
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
