// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "hardhat/console.sol";
import {DataTypes} from "./../libraries/DataTypes.sol";
import {IFactory} from "./../interfaces/IFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./../interfaces/IProducerStorage.sol";

contract ProducerStorage is IProducerStorage, Ownable {
    IFactory factory;
    address public producerApi;
    address public producerNUsage;
    address public producerVestingApi;

    uint private PR_ID; // unique id for each producer
     mapping(address => DataTypes.Producer) internal producers;
    mapping(uint256 => address) public cloneId;

    // producer address=> prPlans
    mapping(address => DataTypes.Plan[]) internal prPlans;
    mapping(uint256 => DataTypes.Plan) internal plans;

    mapping(uint256 => DataTypes.URIParams) internal metadata;
    //plan id to plan info  vesting
    mapping(uint256 => DataTypes.PlanInfoVesting) internal planInfoVesting;
    //plan id to plan info  nusage
    mapping(uint256 => DataTypes.PlanInfoNUsage) internal planInfoNUsage;
    //plan id to plan info  api
    mapping(uint256 => DataTypes.PlanInfoApi) internal planInfoApi;

    // costumer address   costumer tpes
    mapping(address => DataTypes.Customer) internal customers;

    // costumer plan id to costumer plan info  api
    mapping(uint256 => DataTypes.CustomerPlanInfo) internal customerPlanInfo;

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

    event LogProducer(
        address producerAddress,
        string name,
        uint256 producerId,
        address cloneAddress
    );
    event LogProducerSet(
        address producerAddress,
        string name,
        uint256 producerId,
        address cloneAddress
    );
    event LogAddPlan(
        uint256 planId,
        address producerAddress,
        string name,
        DataTypes.PlanTypes planType
    );
    event LogSetPlan(
        uint256 planId,
        address producerAddress,
        string name,
        DataTypes.PlanTypes planType
    );
    event LogAddCustomerPlan(
        address customerAdress,
        uint256 planId,
        uint256 custumerPlanId,
        uint256 producerId,
        address cloneAddress
    );
    event loguseFromQuota(
        uint256 planId,
        address customerAdress,
        address cloneAddress,
        uint256 remainingQuota
    );
    event logUpdateCustomerPlan(
        uint256 planId,
        address customerAdress,
        address cloneAddress,
        DataTypes.Status status
    );

    modifier onlyFactory() {
        console.log("msg.sender", msg.sender);
        console.log("factory", address(factory));
        require(
            msg.sender == address(factory),
            "Only factory can call this function"
        );
        _;
    }
    modifier onlyProducer() {
        require(
            producers[msg.sender].cloneAddress == msg.sender,
            "Only producer  can call this function"
        );
        _;
    }
    modifier onlyExistProducer() {
        require(
            !exsistProducer(msg.sender),
            "onlyExistProducer  can call this function"
        );
        _;
    }
    modifier onlyNonExistProducer() {
        require(
            exsistProducer(msg.sender),
            "onlyExistProducer  can call this function"
        );
        _;
    }
    modifier onlyRegisteredProducer() {
        require(
            producers[msg.sender].cloneAddress != address(0),
            "producer: not registered"
        );
        _;
    }
    modifier onlyProdcuerApi() {
        require(
            msg.sender == address(producerApi),
            " onlyProdcuerApi can call this function"
        );
        _;
    }
    modifier onlyProdcuerNUsage() {
        require(
            msg.sender == address(producerNUsage),
            "onlyProdcuerNUsage can call this function"
        );
        _;
    }
    modifier onlyProdcuerVestingApi() {
        require(
            msg.sender == address(producerVestingApi),
            "  onlyProdcuerVestingApi can call this function"
        );
        _;
    }
    modifier onlyExistCustumer(
        uint256 planId,
        address customerAddress,
        address cloneAddress
    ) {
        require(
            exsitCustomerPlan(planId, customerAddress, cloneAddress) == true,
            "Customer plan not exist"
        );
        _;
    }

    function exsistProducer(address _cloneAddress) public view returns (bool) {
        console.log("exsistProducer", producers[_cloneAddress].exists);
        return producers[_cloneAddress].exists;
    }

    function addProducer(
        DataTypes.Producer calldata vars
    ) external onlyFactory {
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
        // producers[cloneAddress] = producer;
        console.log("addProducer n", cloneAddress);
        emit LogProducer(
            vars.producerAddress,
            vars.name,
            vars.producerId,
            cloneAddress
        );
    }

    function setProducer(
        DataTypes.Producer calldata vars
    ) external onlyProducer onlyNonExistProducer {
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
        //producers[cloneAddress] = producer;
        console.log("setProducer n", vars.cloneAddress);
        emit LogProducerSet(
            vars.producerAddress,
            vars.name,
            vars.producerId,
            vars.cloneAddress
        );
    }

    function addPlanInfoApi(
        DataTypes.PlanInfoApi calldata vars
    ) external onlyProducer onlyNonExistProducer {
        DataTypes.PlanInfoApi memory info = DataTypes.PlanInfoApi(
            vars.planId,
            vars.flowRate,
            vars.perMonthLimit
        );
        planInfoApi[vars.planId] = info;
    }

    function addPlanInfoNUsage(
        DataTypes.PlanInfoNUsage calldata vars
    ) external onlyProducer onlyNonExistProducer {
        DataTypes.PlanInfoNUsage memory info = DataTypes.PlanInfoNUsage(
            vars.planId,
            vars.oneUsagePrice,
            vars.minUsageLimit,
            vars.maxUsagelimit
        );
        planInfoNUsage[vars.planId] = info;
    }

    function addPlanInfoVesting(
        DataTypes.PlanInfoVesting calldata vars
    ) external onlyProducer onlyNonExistProducer {
        DataTypes.PlanInfoVesting memory info = DataTypes.PlanInfoVesting(
            vars.planId, 
            vars.cliffDate,
            vars.flowRate,
            vars.startAmount,
            vars.ctx
        );
        planInfoVesting[vars.planId] = info;
    }

    function addPlan(
        DataTypes.CreatePlanData calldata vars
    ) external onlyNonExistProducer returns (uint256 planId) {
        // get the address of the producer adding the plan
        console.log("addPlan1", vars.name);
        address cloneAddress = msg.sender;
         // create a new Plan object and store it in the mapping
        DataTypes.Plan memory plan = DataTypes.Plan(
            vars.planId,
            cloneAddress,
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
            vars.planType ,
            vars.custumerPlanIds
        );
        prPlans[cloneAddress].push(plan);
        console.log("addPlan2", vars.name);

        plans[vars.planId] = plan;
        emit LogAddPlan(vars.planId, cloneAddress, vars.name, vars.planType);

        return vars.planId;
    }

    function setPlan(
        DataTypes.CreatePlanData calldata vars
    ) external onlyNonExistProducer {
        // get the address of the producer adding the plan
        address cloneAddress = msg.sender;
        // create a new Plan object and store it in the mapping
        DataTypes.Plan memory plan = DataTypes.Plan(
            vars.planId,
            cloneAddress,
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
    function setPlanInfo(
        DataTypes.CreatePlanData calldata vars
    ) internal onlyNonExistProducer {
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

    function getProducer(
        address cloneAddress
    ) external view returns (DataTypes.Producer memory) {
        return producers[cloneAddress];
    }

    function getPlan(
        uint256 _planId
    ) public view returns (DataTypes.Plan memory plan) {
        return plans[_planId];
    }

    function getPlanInfoApi(
        uint256 _planId
    ) public view returns (DataTypes.PlanInfoApi memory pInfoApi) {
        return planInfoApi[_planId];
    }

    function getPlanInfoVesting(
        uint256 _planId
    ) public view returns (DataTypes.PlanInfoVesting memory pInfoVesting) {
        return planInfoVesting[_planId];
    }

    function getPlanInfoNUsage(
        uint256 _planId
    ) public view returns (DataTypes.PlanInfoNUsage memory pInfoNUsage) {
        return planInfoNUsage[_planId];
    }

    function getCustomerPlanInfo(
        uint256 _planId
    ) public view returns (DataTypes.CustomerPlanInfo memory cInfo) {
        return customerPlanInfo[_planId];
    }

    function getPlans(
        address cloneAddress // producer clone address
    ) public view returns (DataTypes.Plan[] memory) {
        DataTypes.Plan[] memory data = new DataTypes.Plan[](
            prPlans[cloneAddress].length
        );
        data = prPlans[cloneAddress];
        return data;
    }

    function getParams(
        uint256 _planId
    ) external view returns (DataTypes.URIParams memory) {
        return metadata[_planId];
    }

    function getCustomer(
        address customerAddress
    ) external view returns (DataTypes.Customer memory) {
        return customers[customerAddress];
    }

    function getCustomerPlanId(
        uint256 planid,
        address customeraddress,
        address producerAddress
    ) public pure returns (uint) {
        return
            uint(
                keccak256(
                    abi.encodePacked(planid, customeraddress, producerAddress)
                )
            );
    }

    function getCustomerPlanIdDecode(
        uint custumerPlanId
    )
        public
        pure
        returns (
            uint256 planid,
            address customeraddress,
            address producerAddress
        )
    {
        (planid, customeraddress, producerAddress) = abi.decode(
            abi.encodePacked(custumerPlanId),
            (uint256, address, address)
        );
        return (planid, customeraddress, producerAddress);
    }

    function setCustomerPlanInfo(
        DataTypes.CustomerPlanInfo memory vars
    ) internal {
        customerPlanInfo[vars.custumerPlanId] = vars;
    }

    function addCustomerPlan(
        DataTypes.CreateCustomerPlan calldata vars
    ) external returns (DataTypes.URIParams memory) {
        uint256 customerPlanId = uint(
            keccak256(
                abi.encodePacked(
                    vars.planId,
                    vars.customerAdress,
                    vars.cloneAddress
                )
            )
        );
        uint256 startTime = block.timestamp;
        uint256 endTime = block.timestamp; // todo  endtime is  in the future
        address customerAddress = vars.customerAdress;
        DataTypes.Customer storage customer = customers[customerAddress];
        customer.customer = customerAddress;
        DataTypes.CustomerPlan memory customerPlan = DataTypes.CustomerPlan(
            customerAddress,
            vars.planId,
            customerPlanId,
            vars.producerId,
            vars.cloneAddress,
            vars.status,
            vars.planType
        );

        customer.customerPlans.push(customerPlan);
        // plan add customerPlanId;
        DataTypes.Plan storage plan=plans[vars.planId];
        plan.custumerPlanIds.push(customerPlanId);
        // producer plans add customerPlanId
        
           for (uint256 i = 0; i < prPlans[vars.cloneAddress].length; i++) {
            if (prPlans[vars.cloneAddress][i].planId == vars.planId) {
              DataTypes.Plan storage prplan=  prPlans[vars.cloneAddress][i];
              prplan.custumerPlanIds.push(customerPlanId);
            }
        }


    
        DataTypes.URIParams memory params;
        params.custumerPlanId = customerPlanId;
        params.planType = plan.planType;
        params.status = vars.status;
        metadata[customerPlanId] = params;
        setCustomerPlanInfo(vars.cInfo);

        emit LogAddCustomerPlan(
            vars.customerAdress,
            vars.planId,
            customerPlanId,
            vars.producerId,
            vars.cloneAddress
        );
        return params;
    }

    function useFromQuota(
        DataTypes.UpdateCustomerPlan calldata vars
    )
        external
        onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress)
        returns (uint256)
    {
        require(
            customerPlanInfo[vars.planId].remainingQuota >= 1,
            "Not enough remaining quota!"
        );
        customerPlanInfo[vars.planId].remainingQuota -= 1;
        emit loguseFromQuota(
            vars.planId,
            vars.customerAdress,
            vars.cloneAddress,
            customerPlanInfo[vars.planId].remainingQuota
        );
        return customerPlanInfo[vars.planId].remainingQuota;
    }

    function updateCustomerPlan(
        DataTypes.UpdateCustomerPlan calldata vars
    )
        external
        onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress)
    {
        if (vars.status == DataTypes.Status.inactive) {
            customerPlanInfo[vars.custumerPlanId].remainingQuota = 0;
        }

        setCustomerPlanInfo(vars.cInfo);
        customers[vars.customerAdress]
            .customerPlans[vars.custumerPlanId]
            .status = vars.status;
        metadata[vars.custumerPlanId].status = vars.status;
        emit logUpdateCustomerPlan(
            vars.planId,
            vars.customerAdress,
            vars.cloneAddress,
            vars.status
        );
    }

    function exsitCustomerPlan(
        uint256 planId,
        address customerAddress,
        address cloneAddress
    ) public view returns (bool) {
        uint256 customerPlanId = getCustomerPlanId(
            planId,
            customerAddress,
            cloneAddress
        );

        if (metadata[customerPlanId].custumerPlanId == customerPlanId) {
            return true;
        } else {
            return false;
        }
    }

    function SetCloneId(
        uint256 _producerId,
        address _cloneAddress
    ) external onlyFactory {
        cloneId[_producerId] = _cloneAddress;
    }

    function getCloneId(uint256 _producerId) external view returns (address) {
        return cloneId[_producerId];
    }

    //
    function getClones(uint256 id) public view returns (address[] memory) {
        // todo index for to much
        address[] memory data = new address[](id + 1);
        for (uint256 i = 1; i < id + 1; i++) {
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

    

  
}
