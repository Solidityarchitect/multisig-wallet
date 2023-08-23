//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./WalletFactory.sol";

contract MultiSigWallet {
    // Type Declarations
    using ECDSA for bytes32;
    WalletFactory public walletFactory;

    // State variables
    mapping(address => bool) public isOwner;
    uint256 public signaturesRequired;
    uint256 public nonce;
    uint256 public chainId;
    address[] public owners;

    // Events
    event Owner(address indexed owner, bool indexed added);
    event ExecuteTransaction(
        address indexed owner,
        address payable to,
        uint256 value,
        bytes data,
        uint256 nonce,
        bytes32 hash,
        bytes result
    );
    event Deposit(address sender, uint256 amount, uint256 balance);

    // Modifiers
    modifier onlySelf() {
        require(msg.sender == address(this), "Not self");
        _;
    }

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }

    modifier atLeastOneSignatures(uint256 _signaturesRequired) {
        require(_signaturesRequired > 0, "at least 1 signatures required");
        _;
    }

    // Constructor
    constructor(
        uint _chainId,
        address[] memory _owners,
        uint _signaturesRequired,
        address payable _walletFactory
    ) payable atLeastOneSignatures(_signaturesRequired) {
        chainId = _chainId;
        signaturesRequired = _signaturesRequired;
        walletFactory = WalletFactory(_walletFactory);
        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "constructor: zero address");
            require(!isOwner[owner], "constructor: owner not unique");
            isOwner[owner] = true;
            owners.push(owner);
            emit Owner(owner, true);
        }
    }

    // Public Function
    function addSigner(
        address newSigner,
        uint256 newSignaturesRequired
    ) public onlySelf atLeastOneSignatures(newSignaturesRequired) {
        require(newSigner != address(0), "addSigner: zero address");
        require(!isOwner[newSigner], "addSigner: owner not unique");
        isOwner[newSigner] = true;
        owners.push(newSigner);
        require(
            newSignaturesRequired <= owners.length,
            "signatures required cannot be greater than owners count"
        );
        signaturesRequired = newSignaturesRequired;
        emit Owner(newSigner, true);
    }

    function removeSigner(
        address oldSigner,
        uint256 newSignaturesRequired
    ) public onlySelf atLeastOneSignatures(newSignaturesRequired) {
        require(isOwner[oldSigner], "removeSigner: not owner");
        uint256 signerCount = owners.length;
        require(
            newSignaturesRequired <= signerCount - 1,
            "Signatures required cannot be greater than owners count"
        );
        signaturesRequired = newSignaturesRequired;
        // Remove from mapping
        delete isOwner[oldSigner];
        // Remove from array
        for (uint256 i = 0; i < signerCount; i++) {
            address owner = owners[i];
            if (owner == oldSigner) {
                owners.pop();
                break;
            }
        }
        emit Owner(oldSigner, false);
    }

    function executeTransaction(
        address payable to,
        uint256 value,
        bytes calldata data,
        bytes[] calldata signatures
    ) public onlyOwner returns (bytes memory) {
        require(
            isOwner[msg.sender],
            "executeTransaction: only owners can execute"
        );
        bytes32 _hash = getTransactionHash(nonce, to, value, data);
        nonce++;

        uint256 validSignatures;
        address duplicateGuard;

        for (uint256 i = 0; i < signatures.length; i++) {
            bytes memory signature = signatures[i];
            address recovered = recover(_hash, signature);
            require(
                recovered > duplicateGuard,
                "duplicate or unordered signatures"
            );
            duplicateGuard = recovered;
            if (isOwner[recovered]) {
                validSignatures++;
            }
        }
        require(
            validSignatures >= signaturesRequired,
            "not enough count of signatures"
        );
        require(
            address(this).balance >= value,
            "executeTransaction: insufficient contract balance"
        );
        (bool sent, bytes memory result) = to.call{value: value}(data);
        require(sent, "executeTransaction: tx failed");
        emit ExecuteTransaction(
            msg.sender,
            to,
            value,
            data,
            nonce - 1,
            _hash,
            result
        );
        return result;
    }

    // Get Function
    function recover(
        bytes32 _hash,
        bytes memory _signatures
    ) public pure returns (address) {
        return _hash.toEthSignedMessageHash().recover(_signatures);
    }

    function getTransactionHash(
        uint256 _nonce,
        address to,
        uint256 value,
        bytes memory data
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    address(this),
                    chainId,
                    _nonce,
                    to,
                    value,
                    data
                )
            );
    }

    function updateSignaturesRequired(
        uint256 newSignaturesRequired
    ) public onlySelf atLeastOneSignatures(newSignaturesRequired) {
        signaturesRequired = newSignaturesRequired;
    }

    // receive
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    ////////////////////////////////
    // Transaction Stream Channel //
    ////////////////////////////////

    // Type declarations
    struct Stream {
        uint256 amount;
        uint256 frequency;
        uint256 last;
    }

    // State variables
    mapping(address => Stream) public streams;

    // Events
    event OpenStream(
        address indexed to,
        uint256 indexed amount,
        uint256 frequency
    );
    event Withdraw(
        address indexed to,
        uint256 indexed amount,
        string indexed reason
    );
    event CloseStream(address indexed to);

    function openStream(
        address to,
        uint256 amount,
        uint256 frequency
    ) public onlySelf{
        require(streams[to].amount == 0, "Stream already opened");
        require(amount > 0, "no amount");
        require(frequency > 0, "no frequency");

        streams[to].amount = amount;
        streams[to].frequency = frequency;
        streams[to].last = block.timestamp;

        emit OpenStream(to, amount, frequency);
    }

    function streamWithdraw(uint256 amount, string memory reason) public {
        require(streams[msg.sender].amount > 0, "no open Stream");
        _streamWithdraw(payable(msg.sender), amount, reason);
    }

    function closeStream(address payable to) public onlySelf {
        require(streams[to].amount > 0, "closeStream: stream already closed");
        _streamWithdraw(to, streams[to].amount, "Close stream");
        delete streams[to];
        emit CloseStream(to);
    }

    // Get Function
    function _streamWithdraw(
        address payable to,
        uint256 amount,
        string memory reason
    ) private {
        uint256 totalAmount = streamBalance(to);
        require(totalAmount >= amount, "Not enough");
        streams[to].last =
            streams[to].last +
            (((block.timestamp - streams[to].last) * amount) / totalAmount);
        emit Withdraw(to, amount, reason);
        to.transfer(amount);
    }

    function streamBalance(address to) public view returns (uint256) {
        return
            (streams[to].amount * (block.timestamp - streams[to].last)) /
            streams[to].frequency;
    }
}
// Pragma statements
// Import statements
// Interfaces
// Libraries
// Contracts
// Inside each contract, library or interface, use the following order:
// Type declarations
// State variables
// Events
// Errors
// Modifiers
// Functions
