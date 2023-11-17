// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "hardhat/console.sol";
import {DataTypes} from "./../libraries/DataTypes.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import {IFactory} from "./../interfaces/IFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./../interfaces/IProducerStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ProducerStorage is IProducerStorage, Ownable {
    IFactory factory;
    using Counters for Counters.Counter;
    Counters.Counter private PR_ID; // unique id for each producer
    Counters.Counter private PL_ID; // unique id for each plan
    mapping(address => DataTypes.Producer) internal producers;
    mapping(uint256 => address) public cloneId;

    // producer address=> prPlans
    mapping(address => DataTypes.Plan[]) internal prPlans;
    mapping(uint256 => DataTypes.Plan) internal plans;
    // costumer address   costumer tpes
    mapping(address => DataTypes.Customer) internal customers;
    mapping(uint256 => DataTypes.URIParams) internal metadata;

    function setFactory(IFactory _factory) external onlyOwner {
        factory = _factory;
    }

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
    require(producers[msg.sender].cloneAddress != address(0), "producer: not registered");
    _;
  }
    function exsistProducer(address _cloneAddress) public view returns (bool) {
        console.log("exsistProducer", producers[_cloneAddress].exists);
        return producers[_cloneAddress].exists;
    }

    function addProducer(
        DataTypes.Producer calldata vars
    ) external onlyFactory {
        DataTypes.Producer memory producer;
        address cloneAddress = payable(vars.cloneAddress);
        producer.producerAddress = vars.producerAddress;
        producer.name = vars.name;
        producer.description = vars.description;
        producer.image = vars.image;
        producer.externalLink = vars.externalLink;
        producer.exists = true;
        producer.producerId = vars.producerId;
        producer.cloneAddress = cloneAddress;
        producers[cloneAddress] = producer;
        console.log("addProducer n", cloneAddress);
    }

    function setProducer(
        DataTypes.Producer calldata vars
    ) external onlyProducer onlyNonExistProducer {
        exsistProducer(msg.sender);
        DataTypes.Producer memory producer;
        address cloneAddress = payable(vars.cloneAddress);
        producer.producerAddress = vars.producerAddress;
        producer.name = vars.name;
        producer.description = vars.description;
        producer.image = vars.image;
        producer.externalLink = vars.externalLink;
        producer.exists = true;
        producer.producerId = vars.producerId;
        producer.cloneAddress = vars.cloneAddress;
        producers[cloneAddress] = producer;
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

    function addPlan(
        DataTypes.CreatePlanData calldata vars
    ) external onlyNonExistProducer {
        // get the address of the producer adding the plan
        address cloneAddress = msg.sender;
        incrementPL_ID();
        // create a new Plan object and store it in the mapping
        DataTypes.Plan memory plan = DataTypes.Plan(
            currenPL_ID(),
            cloneAddress,
            vars.name,
            vars.pricePerSecond,
            vars.status,
            vars.info
        );
        prPlans[cloneAddress].push(plan);
        plans[currenPL_ID()] = plan;
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
            vars.planId,
            customerPlanId,
            vars.producerId,
            vars.cloneAddress,
            vars.price,
            vars.paid_in,
            startTime,
            endTime
        );

        customer.customerPlans.push(customerPlan);
        DataTypes.Producer memory _producer = producers[vars.cloneAddress];
        DataTypes.Plan memory plan = getPlan(vars.planId);
        DataTypes.PlanInfo memory info = plan.info;
        DataTypes.URIParams memory params;
        params.cloneAddress = vars.cloneAddress;
        params.producerId = _producer.producerId;
        params.producerName = _producer.name;
        params.planId = vars.planId;
        params.planName = plan.name;
        params.custumerPlanId = customerPlanId;
        params.startTime = startTime;
        params.endTime = endTime;
        params.price = info.price;
        params.priceAddress = info.priceAddress;
        params.priceSymbol = info.priceSymbol;
        metadata[customerPlanId] = params; 
        return params;
    }

    function SetCloneId(uint256 _producerId, address _cloneAddress) external {
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
        return PR_ID.current();
    }

    function incrementPR_ID() public returns (uint256) {
        PR_ID.increment();
        return PR_ID.current();
    }

    function currenPL_ID() public view returns (uint256) {
        return PL_ID.current();
    }

    function incrementPL_ID() public returns (uint256) {
        PL_ID.increment();
        return PL_ID.current();
    }
}
