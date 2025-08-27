// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Base64} from "./libraries/Base64.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/IURIGenerator.sol";
import {DataTypes} from "./libraries/DataTypes.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol"; 
import {IProducerStorage} from "./interfaces/IProducerStorage.sol";

contract URIGenerator is
    IURIGenerator,
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    ERC1155Upgradeable
{
    IProducerStorage public producerStorage;

    error NFT_TransferIsNotAllowed();
    error NFT_Unauthorized();
    error NFT_Deprecated(uint256 at);

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __UUPSUpgradeable_init();
        __ERC1155_init("");
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

    function setProducerStorage(address _producerStorage) external onlyOwner {
        producerStorage = IProducerStorage(_producerStorage);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    function mint(
        DataTypes.CustomerPlan calldata vars
    )
        external
        onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress)
    {
        
        DataTypes.Plan memory plan = producerStorage.getPlan(vars.planId);

        /*     if  (plan.planType == DataTypes.PlanTypes.api) {
            DataTypes.CustomerPlanInfo memory capi = producerStorage.getCustomerPlanInfo(vars.planId);
              UriMeta memory uriMeta = UriMeta({
                custumerPlanId: custumerPlanId,
                planId: plan.planId,
                description: plan.description,
                externalLink: plan.externalLink,
                totalSupply: plan.totalSupply,
                currentSupply: plan.currentSupply,
                backgroundColor: plan.backgroundColor,
                image: plan.image,
                priceAddress: plan.priceAddress,
                startDate: capi.startDate,
                endDate: capi.endDate,
                remainingQuota: capi.remainingQuota,
                planType: plan.planType,
                status: plan.status     
          
        });

        } */

        _mint(
            vars.customerAdress,
            vars.custumerPlanId,
            1,
            abi.encode(vars.cloneAddress)
        );
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public pure override {
        revert NFT_TransferIsNotAllowed();
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public pure override {
        revert NFT_TransferIsNotAllowed();
    }

    function burn(
        DataTypes.CustomerPlan calldata vars
    )
        external
        onlyExistCustumer(vars.planId, vars.customerAdress, vars.cloneAddress)
    {
        _burn(vars.customerAdress, vars.custumerPlanId, 1);
    }

    function uri(
        uint256 tokenId
    )
        public
        view
        override(ERC1155Upgradeable, IURIGenerator)
        returns (string memory)
    {
         DataTypes.CustomerPlan memory capi = producerStorage
            .getCustomerPlan(tokenId);

        DataTypes.Plan memory plan = producerStorage.getPlan(capi.planId);

        
        DataTypes.Producer memory producer = producerStorage.getProducer(
            capi.cloneAddress
        );
        UriMeta memory uriMeta = UriMeta({
            custumerPlanId: tokenId,
            planId: plan.planId,
            producerName: producer.name,
            cloneAddress: capi.cloneAddress,
            description: plan.description,
            externalLink: plan.externalLink,
            totalSupply: plan.totalSupply,
            currentSupply: plan.currentSupply,
            backgroundColor: plan.backgroundColor,
            image: plan.image,
            priceAddress: plan.priceAddress,
            startDate: capi.startDate,
            endDate: capi.endDate,
            remainingQuota: capi.remainingQuota,
            planType: plan.planType,
            status: plan.status
        });

        if (uriMeta.planType == DataTypes.PlanTypes.api) {
            return constructTokenUriApi(uriMeta);
        }
        if (uriMeta.planType == DataTypes.PlanTypes.vestingApi) {
            return constructTokenUriVestingApi(uriMeta);
        }
        if (uriMeta.planType == DataTypes.PlanTypes.nUsage) {
            return constructTokenUriNUsage(uriMeta);
        }

        return "";
    }

    function constructTokenUriApi(
        UriMeta memory params
    ) public view returns (string memory) {
        return  generateNFT(params);
    }

    function constructTokenUriVestingApi(
        UriMeta memory params
    ) public view returns (string memory) {
        return  generateNFT(params);
    }

    function constructTokenUriNUsage(
        UriMeta memory params
    ) public view returns (string memory) {
        return   generateNFT(params);
    }

    function constructTokenURI(
        UriMeta memory params
    ) public view returns (string memory) {
        string memory svg = generateNFT(params);

        /* solhint-disable quotes */
        return
            string(
                     abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        abi.encodePacked(
                            '{"name":"',
                            generateName(params),
                            '", "description": "',
                            generateDescription(params),
                            '", "image": "data:image/svg+xml;base64,',
                            Base64.encode(bytes(svg)),
                            '"}'
                        )
                    )
                )  
            );
        /* solhint-enable quotes */
    }

    function generateName(
        UriMeta memory params
    ) public pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    params.producerName,
                    "-",
                    params.planId,
                    "-",
                    params.custumerPlanId
                )
            );
    }

    function generateDescription(
        UriMeta memory params
    ) public pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "NFT representing a Bilicance contract. ",
                    " producerName: ",
                    params.producerName,
                    " ProducerId: ",
                    params.planId,
                    " CustumerPlanId: ",
                    params.custumerPlanId,
                    " Producer Contract address: ",
                    addressToString(params.cloneAddress)
                )
            );
    }

    function generateNFT(
        UriMeta memory params
    ) public view returns (string memory) {
      
        uint8 priceDecimals = ERC20(params.priceAddress).decimals();

        return
            string(
                abi.encodePacked(
                    "<svg width='400' height='300' viewBox='0 0 400 300' xmlns='http://www.w3.org/2000/svg'>",
                    "<rect width='100%' height='100%' rx='12' ry='12'  fill='#3E5DC7' />",
                    "<g transform='scale(5), translate(25, 18)' fill-opacity='0.15'>",
                    "<path xmlns='http://www.w3.org/2000/svg' d='M69.3577 14.5031H29.7265L39.6312 0H0L19.8156 29L29.7265 14.5031L39.6312 29H19.8156H0L19.8156 58L39.6312 29L49.5421 43.5031L69.3577 14.5031Z' fill='white'/>",
                    "</g>",
                    _generateHeaderSection(params.producerName),
                    _generateAmountsSection(
                        params.planId,
                        params.producerName,
                        priceDecimals
                    ),
                    _generateDateSection(params),
                    "</svg>"
                )
            );
    }

    // todo  producerName and costumer ıd add
    function _generateHeaderSection(
        string memory _priceSymbol
    ) internal pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    abi.encodePacked(
                        "<text x='16px' y='55px' font-size='32px' fill='#fff' font-family='Helvetica'>",
                        _priceSymbol,
                        "</text>"
                    )
                )
            );
    }

    function _generateAmountsSection(
        uint256 _price,
        string memory _priceSymbol,
        uint8 _priceDecimals
    ) internal pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "<text x='16px' y='176px' font-size='14' letter-spacing='0.01em' fill='#fff' font-family='Helvetica'>PRICE ASSET</text>",
                    _generateAmountString(
                        _price,
                        _priceDecimals,
                        _priceSymbol,
                        16,
                        200
                    )
                )
            );
    }

    function _generateDateSection(
        UriMeta memory params
    ) internal pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "<text x='16px' y='236px' font-size='14' letter-spacing='0.01em' fill='#fff' font-family='Helvetica'>START DATE</text>",
                    _generateTimestampString(params.startDate, 16, 260),
                    "<text x='200px' y='236px' font-size='14' letter-spacing='0.01em' fill='#fff' font-family='Helvetica'>END DATE</text>",
                    _generateTimestampString(params.endDate, 200, 260)
                )
            );
    }

    function _generateAmountString(
        uint256 _amount,
        uint8 _decimals,
        string memory _symbol,
        uint256 _x,
        uint256 _y
    ) internal pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "<text x='",
                    _toString(_x),
                    "px' y='",
                    _toString(_y),
                    "px' font-size='18' fill='#fff' font-family='Helvetica' font-weight='300'>",
                    _decimalString(_amount, _decimals, false),
                    " ",
                    _symbol,
                    "</text>"
                )
            );
    }

    function _generateTimestampString(
        uint256 _timestamp,
        uint256 _x,
        uint256 _y
    ) internal pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "<text x='",
                    _toString(_x),
                    "px' y='",
                    _toString(_y),
                    "px' font-size='18' fill='#fff' font-family='Helvetica' font-weight='300'>",
                    _generateDateString(_timestamp),
                    "</text>"
                )
            );
    }

    /// @notice Utilities
    struct DecimalStringParams {
        // significant figures of decimal
        uint256 sigfigs;
        // length of decimal string
        uint8 bufferLength;
        // ending index for significant figures (funtion works backwards when copying sigfigs)
        uint8 sigfigIndex;
        // index of decimal place (0 if no decimal)
        uint8 decimalIndex;
        // start index for trailing/leading 0's for very small/large numbers
        uint8 zerosStartIndex;
        // end index for trailing/leading 0's for very small/large numbers
        uint8 zerosEndIndex;
        // true if decimal number is less than one
        bool isLessThanOne;
        // true if string should include "%"
        bool isPercent;
    }

    function _generateDecimalString(
        DecimalStringParams memory params
    ) internal pure returns (string memory) {
        bytes memory buffer = new bytes(params.bufferLength);
        if (params.isPercent) {
            buffer[buffer.length - 1] = "%";
        }
        if (params.isLessThanOne) {
            buffer[0] = "0";
            buffer[1] = ".";
        }

        // add leading/trailing 0's
        for (
            uint256 zerosCursor = params.zerosStartIndex;
            zerosCursor < params.zerosEndIndex;
            zerosCursor++
        ) {
            buffer[zerosCursor] = bytes1(uint8(48));
        }
        // add sigfigs
        while (params.sigfigs > 0) {
            if (
                params.decimalIndex > 0 &&
                params.sigfigIndex == params.decimalIndex
            ) {
                buffer[--params.sigfigIndex] = ".";
            }
            buffer[--params.sigfigIndex] = bytes1(
                uint8(uint256(48) + (params.sigfigs % 10))
            );
            params.sigfigs /= 10;
        }
        return string(buffer);
    }

    function _decimalString(
        uint256 number,
        uint8 decimals,
        bool isPercent
    ) internal pure returns (string memory) {
        uint8 percentBufferOffset = isPercent ? 1 : 0;
        uint256 tenPowDecimals = 10 ** decimals;

        uint256 temp = number;
        uint8 digits = 0;
        uint8 numSigfigs = 0;
        while (temp != 0) {
            if (numSigfigs > 0) {
                // count all digits preceding least significant figure
                numSigfigs++;
            } else if (temp % 10 != 0) {
                numSigfigs++;
            }
            digits++;
            temp /= 10;
        }

        DecimalStringParams memory params = DecimalStringParams({
            sigfigs: uint256(0),
            bufferLength: uint8(0),
            sigfigIndex: uint8(0),
            decimalIndex: uint8(0),
            zerosStartIndex: uint8(0),
            zerosEndIndex: uint8(0),
            isLessThanOne: false,
            isPercent: false
        });
        params.isPercent = isPercent;
        if ((digits - numSigfigs) >= decimals) {
            // no decimals, ensure we preserve all trailing zeros
            params.sigfigs = number / tenPowDecimals;
            params.sigfigIndex = digits - decimals;
            params.bufferLength = params.sigfigIndex + percentBufferOffset;
        } else {
            // chop all trailing zeros for numbers with decimals
            params.sigfigs = number / (10 ** (digits - numSigfigs));
            if (tenPowDecimals > number) {
                // number is less tahn one
                // in this case, there may be leading zeros after the decimal place
                // that need to be added

                // offset leading zeros by two to account for leading '0.'
                params.zerosStartIndex = 2;
                params.zerosEndIndex = decimals - digits + 2;
                // params.zerosStartIndex = 4;
                params.sigfigIndex = numSigfigs + params.zerosEndIndex;
                params.bufferLength = params.sigfigIndex + percentBufferOffset;
                params.isLessThanOne = true;
            } else {
                // In this case, there are digits before and
                // after the decimal place
                params.sigfigIndex = numSigfigs + 1;
                params.decimalIndex = digits - decimals + 1;
            }
        }
        params.bufferLength = params.sigfigIndex + percentBufferOffset;
        return _generateDecimalString(params);
    }

    function _getDateUnits(
        uint256 _timestamp
    ) internal pure returns (uint256 month, uint256 day, uint256 year) {
        int256 z = int256(_timestamp) / 86400 + 719468;
        int256 era = (z >= 0 ? z : z - 146096) / 146097;
        int256 doe = z - era * 146097;
        int256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        int256 y = yoe + era * 400;
        int256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        int256 mp = (5 * doy + 2) / 153;
        int256 d = doy - (153 * mp + 2) / 5 + 1;
        int256 m = mp + (mp < 10 ? int256(3) : -9);

        if (m <= 2) {
            y += 1;
        }

        month = uint256(m);
        day = uint256(d);
        year = uint256(y);
    }

    function _generateDateString(
        uint256 _timestamp
    ) internal pure returns (string memory) {
        int256 z = int256(_timestamp) / 86400 + 719468;
        int256 era = (z >= 0 ? z : z - 146096) / 146097;
        int256 doe = z - era * 146097;
        int256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        int256 y = yoe + era * 400;
        int256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        int256 mp = (5 * doy + 2) / 153;
        int256 d = doy - (153 * mp + 2) / 5 + 1;
        int256 m = mp + (mp < 10 ? int256(3) : -9);

        if (m <= 2) {
            y += 1;
        }

        string memory s = "";

        if (m < 10) {
            s = _toString(0);
        }

        s = string(abi.encodePacked(s, _toString(uint256(m)), bytes1(0x2F)));

        if (d < 10) {
            s = string(abi.encodePacked(s, bytes1(0x30)));
        }

        s = string(
            abi.encodePacked(
                s,
                _toString(uint256(d)),
                bytes1(0x2F),
                _toString(uint256(y))
            )
        );

        return string(s);
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        // This is borrowed from https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Strings.sol#L16

        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);

        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    bytes16 internal constant ALPHABET = "0123456789abcdef";

    function toHexString(
        uint256 value,
        uint256 length
    ) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = ALPHABET[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }

    function addressToString(
        address addr
    ) internal pure returns (string memory) {
        return toHexString(uint256(uint160(addr)), 20);
    }

     
}
