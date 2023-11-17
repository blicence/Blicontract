// SPDX-License-Identifier: MIT

pragma solidity >=0.8.4;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

abstract contract OnChainMetadata {
    struct Metadata {
        uint256 keyCount; // number of metadata keys
        mapping(bytes32 => bytes[]) data; // key => values
        mapping(bytes32 => uint256) valueCount; // key => number of values
    }

    Metadata _producerMetadata; // metadata for the producer
    mapping(uint256 => Metadata) _tokenMetadata; // metadata for each token

    bytes32 constant key_token_planId = "planId";
    bytes32 constant key_token_name = "name";
    bytes32 constant key_token_description = "description";
    bytes32 constant key_token_image = "image";
    bytes32 constant key_token_price = "price";
    bytes32 constant key_token_external_link = "external_link";
    bytes32 constant key_token_background_color = "background_color";
    bytes32 constant key_token_status = "status";

    /**
     * @dev Get the values of a token metadata key.
     * @param tokenId the token identifier.
     * @param key the token metadata key.
     */
    function _getValues(uint256 tokenId, bytes32 key)
        internal
        view
        returns (bytes[] memory)
    {
        return _tokenMetadata[tokenId].data[key];
    }

    /**
     * @dev Get the first value of a token metadata key.
     * @param tokenId the token identifier.
     * @param key the token metadata key.
     */
    function _getValue(uint256 tokenId, bytes32 key)
        internal
        view
        returns (bytes memory)
    {
        bytes[] memory array = _getValues(tokenId, key);
        if (array.length > 0) {
            return array[0];
        } else {
            return "";
        }
    }

    /**
     * @dev Get the values of a contract metadata key.
     * @param key the contract metadata key.
     */
    function _getValues(bytes32 key) internal view returns (bytes[] memory) {
        return _producerMetadata.data[key];
    }

    /**
     * @dev Get the first value of a contract metadata key.
     * @param key the contract metadata key.
     */
    function _getValue(bytes32 key) internal view returns (bytes memory) {
        bytes[] memory array = _getValues(key);
        if (array.length > 0) {
            return array[0];
        } else {
            return "";
        }
    }

    /**
     * @dev Set the values on a token metadata key.
     * @param tokenId the token identifier.
     * @param key the token metadata key.
     * @param values the token metadata values.
     */
    function _setValues(
        uint256 tokenId,
        bytes32 key,
        bytes[] memory values
    ) internal {
        Metadata storage meta = _tokenMetadata[tokenId];

        if (meta.valueCount[key] == 0) {
            _tokenMetadata[tokenId].keyCount = meta.keyCount + 1;
        }
        _tokenMetadata[tokenId].data[key] = values;
        _tokenMetadata[tokenId].valueCount[key] = values.length;
    }

    /**
     * @dev Set a single value on a token metadata key.
     * @param tokenId the token identifier.
     * @param key the token metadata key.
     * @param value the token metadata value.
     */
    function _setValue(
        uint256 tokenId,
        bytes32 key,
        bytes memory value
    ) internal {
        bytes[] memory values = new bytes[](1);
        values[0] = value;
        _setValues(tokenId, key, values);
    }

    /**
     * @dev Set values on a given Metadata instance.
     * @param meta the metadata to modify.
     * @param key the token metadata key.
     * @param values the token metadata values.
     */
    function _addValues(
        Metadata storage meta,
        bytes32 key,
        bytes[] memory values
    ) internal {
        require(
            meta.valueCount[key] == 0,
            "Metadata already contains given key"
        );
        meta.keyCount = meta.keyCount + 1;
        meta.data[key] = values;
        meta.valueCount[key] = values.length;
    }

    /**
     * @dev Set a single value on a given Metadata instance.
     * @param meta the metadata to modify.
     * @param key the token metadata key.
     * @param value the token metadata value.
     */
    function _addValue(
        Metadata storage meta,
        bytes32 key,
        bytes memory value
    ) internal {
        bytes[] memory values = new bytes[](1);
        values[0] = value;
        _addValues(meta, key, values);
    }

    function _createTokenURI(uint256 tokenId)
        internal
        view
        virtual
        returns (string memory)
    {
        bytes memory planId = _getValue(tokenId, key_token_planId);
        string memory name = string(
            abi.decode(_getValue(tokenId, key_token_name), (string))
        );
        string memory description = string(
            abi.decode(_getValue(tokenId, key_token_description), (string))
        );
        bytes memory image = _getValue(tokenId, key_token_image);
        bytes memory price = _getValue(tokenId, key_token_price);
        bytes memory external_link = _getValue(
            tokenId,
            key_token_external_link
        );
        /*     bytes memory background_color = _getValue(
            tokenId,
            key_token_background_color
        ); */
        bytes memory status = _getValue(tokenId, key_token_status);

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        abi.encodePacked(
                            "{",
                            '"name": "',
                            name,
                            '", ',
                            '"planId": "',
                            planId,
                            '", ',
                            '"description": "',
                            description,
                            '"',
                            bytes(image).length > 0
                                ? string(
                                    abi.encodePacked(
                                        ', "image": "',
                                        string(abi.decode(image, (string))),
                                        '"'
                                    )
                                )
                                : "",
                            bytes(price).length > 0
                                ? string(
                                    abi.encodePacked(
                                        ', "price": "',
                                        string(abi.decode(price, (string))),
                                        '"'
                                    )
                                )
                                : "",
                            bytes(external_link).length > 0
                                ? string(
                                    abi.encodePacked(
                                        ', "external_link": "',
                                        string(
                                            abi.decode(external_link, (string))
                                        ),
                                        '"'
                                    )
                                )
                                : "",
                            "}"
                        )
                    )
                )
            );
    }
}
