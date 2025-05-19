pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDCMock is ERC20 {
	constructor() ERC20("USD Coin", "USDC") {}

	function decimals() public view override returns (uint8) {
		return 6;
	}

	function mint(address to_, uint256 amount_) external {
		_mint(to_, amount_);
	}
}
