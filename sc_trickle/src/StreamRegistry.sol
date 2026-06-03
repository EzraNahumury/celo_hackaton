// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title StreamRegistry — on-chain employer-attested payroll metadata for Trickle
/// @notice Companion to TrickleVault. Writes are keyed by msg.sender, so a caller can
///         only ever write its own records. Fully independent of TrickleVault.
/// @dev PRIVACY: names/memos are PUBLIC and PERMANENT on-chain. Values persist in
///      history/logs/archive nodes. Surface a consent disclaimer in any UI before writing.
contract StreamRegistry {
    struct Employment {
        string name;
        string role;
        string memo;
    }

    mapping(address => string) private _employerName;                       // payer => company name
    mapping(address => mapping(address => Employment)) private _employment; // payer => payee => record
    mapping(address => mapping(address => bool)) public payeeCleared;        // payer => payee => suppressed

    uint256 private constant MAX_NAME = 32;
    uint256 private constant MAX_ROLE = 32;
    uint256 private constant MAX_MEMO = 64;

    event EmployerNameSet(address indexed payer, string name);
    event EmploymentSet(address indexed payer, address indexed payee, string name, string role, string memo);
    event EmploymentCleared(address indexed payer, address indexed payee);

    /// @notice Set the caller's company name. Published PUBLICLY and PERMANENTLY on Celo.
    function setEmployerName(string calldata name) external {
        require(bytes(name).length <= MAX_NAME, "name too long");
        _employerName[msg.sender] = name;
        emit EmployerNameSet(msg.sender, name);
    }

    function getEmployerName(address payer) external view returns (string memory) {
        return _employerName[payer];
    }

    /// @notice Attest an employment record about `payee`. Caller is the employer.
    ///         Published PUBLICLY and PERMANENTLY on Celo.
    function setEmployment(
        address payee,
        string calldata name,
        string calldata role,
        string calldata memo
    ) external {
        require(payee != address(0), "zero payee");
        require(payee != msg.sender, "self payee");
        require(bytes(name).length <= MAX_NAME, "name too long");
        require(bytes(role).length <= MAX_ROLE, "role too long");
        require(bytes(memo).length <= MAX_MEMO, "memo too long");
        _employment[msg.sender][payee] = Employment(name, role, memo);
        emit EmploymentSet(msg.sender, payee, name, role, memo);
    }

    function getEmployment(address payer, address payee)
        external
        view
        returns (string memory name, string memory role, string memory memo)
    {
        Employment storage e = _employment[payer][payee];
        return (e.name, e.role, e.memo);
    }
}
