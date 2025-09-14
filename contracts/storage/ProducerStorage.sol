// SPDX-License-Identifier: MIT

pragma solidity 0.8.30;

import {DataTypes} from "./../libraries/DataTypes.sol";
import {IFactory} from "./../interfaces/IFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./../interfaces/IProducerStorage.sol";
import {ProducerStorageErrors} from "./../errors/ProducerStorageErrors.sol";

contract ProducerStorage is IProducerStorage, Ownable {
    IFactory factory;
    address public producerApi;
    address public producerNUsage;
    address public producerVestingApi;

    constructor(address initialOwner) Ownable(initialOwner) {}

    uint private PR_ID; // unique id for each producer
    mapping(address => DataTypes.Producer) internal producers;
    mapping(uint256 => address) public cloneId;
    // producer address=> clone address
    mapping(address => address) public producertoCloneAddress;

    // producer address=> prPlans
    mapping(address => DataTypes.Plan[]) internal prPlans;
    mapping(uint256 => DataTypes.Plan) internal plans;

    //plan id to plan info  vesting
    mapping(uint256 => DataTypes.PlanInfoVesting) internal planInfoVesting;
    //plan id to plan info  nusage
    mapping(uint256 => DataTypes.PlanInfoNUsage) internal planInfoNUsage;
    //plan id to plan info  api
    mapping(uint256 => DataTypes.PlanInfoApi) internal planInfoApi;

    // costumer address   costumer tpes
    mapping(address => DataTypes.Customer) internal customers;
    mapping(uint256 => DataTypes.CustomerPlan) internal customerPlans;

    function setFactory(
        IFactory _factory,
        address _producerApi,
        address _producerUsageApi,
        address _producervestingApi
    ) external onlyOwner {
        factory = _factory;
        producerApi = _producerApi;
        producerNUsage = _producerUsageApi;
        producerVestingApi = _producervestingApi;
    }

    /**
     * @dev Set factory address only
     * @param _factory Factory contract address
     */
    function setFactoryAddress(address _factory) external onlyOwner {
        factory = IFactory(_factory);
    }

    event LogProducer(address producerAddress, string name, uint256 producerId, address cloneAddress);
    event LogProducerSet(address producerAddress, string name, uint256 producerId, address cloneAddress);
    event LogAddPlan(uint256 planId, address producerAddress, string name, DataTypes.PlanTypes planType);
    event LogSetPlan(uint256 planId, address producerAddress, string name, DataTypes.PlanTypes planType);
    event LogAddCustomerPlan(address customerAdress, uint256 planId, uint256 custumerPlanId, address cloneAddress);
    event loguseFromQuota(uint256 planId, address customerAdress, address cloneAddress, uint256 remainingQuota);
    event logUpdateCustomerPlan(uint256 planId, address customerAdress, address cloneAddress, DataTypes.Status status);

    modifier onlyFactory() {
        if (msg.sender != address(factory)) revert ProducerStorageErrors.OnlyFactory();
        _;
    }
    modifier onlyProducer() {
        if (producers[msg.sender].cloneAddress != msg.sender) revert ProducerStorageErrors.OnlyProducer();
        _;
    }
    modifier onlyExistProducer() {
        if (exsistProducer(msg.sender)) revert ProducerStorageErrors.OnlyExistingProducer();
        _;
    }
    modifier onlyNonExistProducer() {
        if (!exsistProducer(msg.sender)) revert ProducerStorageErrors.OnlyNonExistingProducer();
        _;
    }
    // call only from producer contract
    modifier onlyRegisteredProducer() {
        if (producers[msg.sender].cloneAddress == address(0)) revert ProducerStorageErrors.OnlyRegisteredProducer();
        _;
    }
    // call only from producerApi contract
    modifier onlyProdcuerApi() {
        if (msg.sender != address(producerApi)) revert ProducerStorageErrors.OnlyProducerApi();
        _;
    }

    modifier onlyProdcuerNUsage() {
        if (msg.sender != address(producerNUsage)) revert ProducerStorageErrors.OnlyProducerNUsage();
        _;
    }
    modifier onlyProdcuerVestingApi() {
        if (msg.sender != address(producerVestingApi)) revert ProducerStorageErrors.OnlyProducerVestingApi();
        _;
    }
    modifier onlyExistCustumer(
        uint256 planId,
        address customerAddress,
        address cloneAddress
    ) {
        if (!exsitCustomerPlan(planId, customerAddress, cloneAddress)) revert ProducerStorageErrors.CustomerPlanNotExist();
        _;
    }

    function exsistProducer(address _cloneAddress) public view returns (bool) {
        return producers[_cloneAddress].exists;
    }

    function exsistProducerClone(address producerAddres) public view returns (bool) {
        address _cloneAddress = producertoCloneAddress[producerAddres];

        return producers[_cloneAddress].exists;
    }

    function addProducer(DataTypes.Producer calldata vars) external onlyFactory {
        DataTypes.Producer storage producer = producers[vars.cloneAddress];
        address cloneAddress = payable(vars.cloneAddress);
        producer.producerAddress = vars.producerAddress;
        producer.name = vars.name;
        producer.description = vars.description;
        producer.image = vars.image;
        producer.externalLink = vars.externalLink;
        producer.exists = true;
        producer.producerId = vars.producerId;
        producer.cloneAddress = cloneAddress;
        producertoCloneAddress[vars.producerAddress] = cloneAddress;
        // producers[cloneAddress] = producer;

        emit LogProducer(vars.producerAddress, vars.name, vars.producerId, cloneAddress);
    }

    function setProducer(DataTypes.Producer calldata vars) external onlyProducer onlyNonExistProducer {
        DataTypes.Producer storage producer = producers[vars.cloneAddress];
        // address cloneAddress = payable(vars.cloneAddress);
        producer.producerAddress = vars.producerAddress;
        producer.name = vars.name;
        producer.description = vars.description;
        producer.image = vars.image;
        producer.externalLink = vars.externalLink;
        producer.exists = true;
        producer.producerId = vars.producerId;
        producer.cloneAddress = vars.cloneAddress;
        producertoCloneAddress[vars.producerAddress] = vars.cloneAddress;
        //producers[cloneAddress] = producer;

        emit LogProducerSet(vars.producerAddress, vars.name, vars.producerId, vars.cloneAddress);
    }

    function addPlanInfoApi(DataTypes.PlanInfoApi calldata vars) external onlyProducer onlyNonExistProducer {
        DataTypes.PlanInfoApi memory info = DataTypes.PlanInfoApi(vars.planId, vars.flowRate, vars.perMonthLimit);
        planInfoApi[vars.planId] = info;
    }

    function addPlanInfoNUsage(DataTypes.PlanInfoNUsage calldata vars) external onlyProducer onlyNonExistProducer {
        DataTypes.PlanInfoNUsage memory info = DataTypes.PlanInfoNUsage(
            vars.planId,
            vars.oneUsagePrice,
            vars.minUsageLimit,
            vars.maxUsageLimit
        );
        planInfoNUsage[vars.planId] = info;
    }

    function addPlanInfoVesting(DataTypes.PlanInfoVesting calldata vars) external onlyProducer onlyNonExistProducer {
        DataTypes.PlanInfoVesting memory info = DataTypes.PlanInfoVesting(
            vars.planId,
            vars.cliffDate,
            vars.flowRate,
            vars.startAmount,
            vars.ctx
        );
        planInfoVesting[vars.planId] = info;
    }

    function addPlan(DataTypes.Plan calldata vars) external onlyNonExistProducer returns (uint256 planId) {
        // get the address of the producer adding the plan
        if (plans[vars.planId].planId == vars.planId) revert ProducerStorageErrors.PlanAlreadyExists();

        address cloneAddress = msg.sender;
        // create a new Plan object and store it in the mapping
        DataTypes.Plan memory plan = DataTypes.Plan(
            vars.planId,
            cloneAddress,
            vars.producerId,
            vars.name,
            vars.description,
            vars.externalLink,
            vars.totalSupply,
            vars.currentSupply,
            vars.backgroundColor,
            vars.image,
            vars.priceAddress,
            vars.startDate,
            vars.status,
            vars.planType,
            vars.custumerPlanIds
        );
        prPlans[cloneAddress].push(plan);

        plans[vars.planId] = plan;
        emit LogAddPlan(vars.planId, cloneAddress, vars.name, vars.planType);

        return vars.planId;
    }

    function setPlan(DataTypes.Plan calldata vars) external onlyNonExistProducer {
        // get the address of the producer adding the plan
        address cloneAddress = msg.sender;
        // create a new Plan object and store it in the mapping
        DataTypes.Plan memory plan = DataTypes.Plan(
            vars.planId,
            cloneAddress,
            vars.producerId,
            vars.name,
            vars.description,
            vars.externalLink,
            vars.totalSupply,
            vars.currentSupply,
            vars.backgroundColor,
            vars.image,
            vars.priceAddress,
            vars.startDate,
            vars.status,
            vars.planType,
            vars.custumerPlanIds
        );
        // prPlans[cloneAddress].push(plan);
        plans[vars.planId] = plan;
        for (uint256 i = 0; i < prPlans[cloneAddress].length; i++) {
            if (prPlans[cloneAddress][i].planId == vars.planId) {
                prPlans[cloneAddress][i] = plan;
            }
        }
        emit LogSetPlan(vars.planId, cloneAddress, vars.name, vars.planType);
    }

    // todo setPlantype only producer
    function setPlanInfo(DataTypes.Plan calldata vars) internal onlyNonExistProducer {
        /*    if (vars.planType == DataTypes.PlanTypes.api) {
            DataTypes.PlanInfoApi memory info = DataTypes.PlanInfoApi(
                vars.planInfoApi.planId,
                vars.planInfoApi.description,
                vars.planInfoApi.externalLink,
                vars.planInfoApi.totalSupply,
                vars.planInfoApi.currentSupply,
                vars.planInfoApi.backgroundColor,
                vars.planInfoApi.image,
                vars.planInfoApi.priceAddress,
                vars.planInfoApi.startDate,
                vars.planInfoApi.flowRate,
                vars.planInfoApi.perMonthLimit
            );
            planInfoApi[vars.planInfoApi.planId] = info;
        }
        if (vars.planType == DataTypes.PlanTypes.nUsage) {
            DataTypes.PlanInfoNUsage memory info = DataTypes.PlanInfoNUsage(
                vars.planInfoNUsage.planId,
                vars.planInfoNUsage.description,
                vars.planInfoNUsage.externalLink,
                vars.planInfoNUsage.totalSupply,
                vars.planInfoNUsage.currentSupply,
                vars.planInfoNUsage.backgroundColor,
                vars.planInfoNUsage.image,
                vars.planInfoNUsage.priceAddress,
                vars.planInfoNUsage.startDate,
                vars.planInfoNUsage.oneUsagePrice,
                vars.planInfoNUsage.minUsageLimit,
                vars.planInfoNUsage.maxUsagelimit
            );
            planInfoNUsage[vars.planInfoNUsage.planId] = info;
        }
        if (vars.planType == DataTypes.PlanTypes.vestingApi) {
            DataTypes.PlanInfoVesting memory info = DataTypes.PlanInfoVesting(
                vars.planInfoVesting.planId,
                vars.planInfoVesting.description,
                vars.planInfoVesting.externalLink,
                vars.planInfoVesting.totalSupply,
                vars.planInfoVesting.currentSupply,
                vars.planInfoVesting.backgroundColor,
                vars.planInfoVesting.image,
                vars.planInfoVesting.startDate,
                vars.planInfoVesting.cliffDate,
                vars.planInfoVesting.flowRate,
                vars.planInfoVesting.startAmount,
                vars.planInfoVesting.ctx
            );
            planInfoVesting[vars.planInfoVesting.planId] = info;
        } */
    }

    function getProducer(address cloneAddress) external view returns (DataTypes.Producer memory) {
        return producers[cloneAddress];
    }

    function getProducerInfo(address producerAddres) external view returns (DataTypes.Producer memory) {
        address _cloneAddress = producertoCloneAddress[producerAddres];

        return producers[_cloneAddress];
    }

    function getPlan(uint256 _planId) public view returns (DataTypes.Plan memory plan) {
        return plans[_planId];
    }

    function getPlanInfoApi(uint256 _planId) public view returns (DataTypes.PlanInfoApi memory pInfoApi) {
        return planInfoApi[_planId];
    }

    function getPlanInfoVesting(uint256 _planId) public view returns (DataTypes.PlanInfoVesting memory pInfoVesting) {
        return planInfoVesting[_planId];
    }

    function getPlanInfoNUsage(uint256 _planId) public view returns (DataTypes.PlanInfoNUsage memory pInfoNUsage) {
        return planInfoNUsage[_planId];
    }

    function getPlans(
        address cloneAddress // producer clone address
    ) public view returns (DataTypes.Plan[] memory) {
        DataTypes.Plan[] memory data = new DataTypes.Plan[](prPlans[cloneAddress].length);
        data = prPlans[cloneAddress];

        return data;
    }

    function getCustomer(address customerAddress) external view returns (DataTypes.Customer memory) {
        return customers[customerAddress];
    }

    function getCustomerPlan(uint custumerPlanId) public view returns (DataTypes.CustomerPlan memory) {
        return customerPlans[custumerPlanId];
    }

    function getCustomerPlanId(
        uint256 planid,
        address customeraddress,
        address producerAddress
    ) public pure returns (uint) {
        return uint(keccak256(abi.encodePacked(planid, customeraddress, producerAddress)));
    }

    function addCustomerPlan(DataTypes.CustomerPlan calldata vars) external {
        uint256 customerPlanId = uint(keccak256(abi.encodePacked(vars.planId, vars.customerAdress, vars.cloneAddress)));

        address customerAddress = vars.customerAdress;
        DataTypes.Customer storage customer = customers[customerAddress];
        customer.customer = customerAddress;
        DataTypes.CustomerPlan memory customerPlan = DataTypes.CustomerPlan(
            customerAddress,
            vars.planId,
            customerPlanId,
            vars.producerId,
            vars.cloneAddress,
            vars.priceAddress,
            vars.startDate,
            vars.endDate,
            vars.remainingQuota,
            vars.status,
            vars.planType,
            0, // streamId - initially 0 (no stream)
            false // hasActiveStream - initially false
        );

        customer.customerPlans.push(customerPlan);
        // plan add customerPlanId;
        DataTypes.Plan storage plan = plans[vars.planId];
        plan.custumerPlanIds.push(customerPlanId);
        customerPlans[customerPlanId] = customerPlan;

        // producer plans add customerPlanId

        for (uint256 i = 0; i < prPlans[vars.cloneAddress].length; i++) {
            if (prPlans[vars.cloneAddress][i].planId == vars.planId) {
                DataTypes.Plan storage prplan = prPlans[vars.cloneAddress][i];
                prplan.custumerPlanIds.push(customerPlanId);
            }
        }

        emit LogAddCustomerPlan(vars.customerAdress, vars.planId, customerPlanId, vars.cloneAddress);
    }

    function useFromQuota(
        DataTypes.CustomerPlan calldata vars
    ) external onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress) returns (uint256) {
        uint256 customerPlanId = uint(keccak256(abi.encodePacked(vars.planId, vars.customerAdress, vars.cloneAddress)));
        if (customerPlans[customerPlanId].remainingQuota < 1) revert ProducerStorageErrors.InsufficientQuota();
        customerPlans[customerPlanId].remainingQuota -= 1;
        emit loguseFromQuota(
            vars.planId,
            vars.customerAdress,
            vars.cloneAddress,
            customerPlans[customerPlanId].remainingQuota
        );
        return customerPlans[customerPlanId].remainingQuota;
    }

    function updateCustomerPlan(
        DataTypes.CustomerPlan calldata vars
    ) external onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress) {
        if (vars.status == DataTypes.Status.inactive) {
            customerPlans[vars.custumerPlanId].status = DataTypes.Status.inactive;
            customerPlans[vars.custumerPlanId].remainingQuota = 0;
            customers[vars.customerAdress].customerPlans[vars.custumerPlanId].remainingQuota = 0;
        }
        if (vars.status == DataTypes.Status.active) {
            customerPlans[vars.custumerPlanId].remainingQuota = vars.remainingQuota;
            customers[vars.customerAdress].customerPlans[vars.custumerPlanId].remainingQuota = vars.remainingQuota;
        }

        customers[vars.customerAdress].customerPlans[vars.custumerPlanId].status = vars.status;
        emit logUpdateCustomerPlan(vars.planId, vars.customerAdress, vars.cloneAddress, vars.status);
    }

    function exsitCustomerPlan(
        uint256 planId,
        address customerAddress,
        address cloneAddress
    ) public view returns (bool) {
        uint256 customerPlanId = getCustomerPlanId(planId, customerAddress, cloneAddress);
        //todo check if customerPlanId is in plan.custumerPlanIds
        if (customerPlans[customerPlanId].custumerPlanId == customerPlanId) {
            return true;
        } else {
            return false;
        }
    }

    function SetCloneId(uint256 _producerId, address _cloneAddress) external onlyFactory {
        cloneId[_producerId] = _cloneAddress;
    }

    function getCloneId(uint256 _producerId) external view returns (address) {
        return cloneId[_producerId];
    }

    //
    function getClones() public view returns (address[] memory) {
        // todo index for to much
        uint256 length = currentPR_ID() + 1;
        address[] memory data = new address[](length);
        for (uint256 i = 1; i < length; i++) {
            data[i] = cloneId[i];
        }
        return data;
    }

    function currentPR_ID() public view returns (uint256) {
        return PR_ID;
    }

    function incrementPR_ID() public returns (uint256) {
        PR_ID++;
        return PR_ID;
    }

    /**
     * @dev Set API plan information for a specific plan ID
     * @param _planId Plan ID to update
     * @param vars API plan information
     */
    function setPlanInfoApi(uint256 _planId, DataTypes.PlanInfoApi calldata vars) external {
        require(
            msg.sender == producerApi || msg.sender == owner(),
            "Only producer API contract or owner can call this function"
        );
        planInfoApi[_planId] = vars;
    }

    /**
     * @dev Set vesting plan information for a specific plan ID
     * @param _planId Plan ID to update
     * @param vars Vesting plan information
     */
    function setPlanInfoVesting(uint256 _planId, DataTypes.PlanInfoVesting calldata vars) external {
        require(
            msg.sender == producerVestingApi || msg.sender == owner(),
            "Only producer vesting API contract or owner can call this function"
        );
        planInfoVesting[_planId] = vars;
    }

    function setPlanInfoNUsage(uint256 _planId, DataTypes.PlanInfoNUsage calldata vars) external {
        require(
            msg.sender == producerNUsage || msg.sender == owner(),
            "Only producer N-Usage API contract or owner can call this function"
        );
        planInfoNUsage[_planId] = vars;
    }

    /**
     * @dev Set customer plan information for a specific customer plan ID
     * @param _customerPlanId Customer plan ID to update
     * @param vars Customer plan information
     */
    function setCustomerPlan(uint256 _customerPlanId, DataTypes.CustomerPlan calldata vars) external {
        require(
            msg.sender == producerApi || msg.sender == producerVestingApi || msg.sender == owner(),
            "Only logic contracts or owner can call this function"
        );
        customerPlans[_customerPlanId] = vars;
    }
}
