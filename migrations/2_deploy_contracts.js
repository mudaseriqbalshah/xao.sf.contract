const XAOToken = artifacts.require("XAOToken");
const ArtistFactory = artifacts.require("ArtistFactory");
const EventFactory = artifacts.require("EventFactory");
const ArtistVenueArbitration = artifacts.require("ArtistVenueArbitration");

module.exports = async function(deployer, network, accounts) {
  const eventCreationFee = web3.utils.toWei("0.01", "ether"); // 0.01 ETH fee

  // Deploy XAOToken
  await deployer.deploy(XAOToken);
  console.log("XAOToken deployed at:", XAOToken.address);

  // Deploy ArtistFactory
  await deployer.deploy(ArtistFactory);
  const artistFactory = await ArtistFactory.deployed();
  console.log("ArtistFactory deployed at:", ArtistFactory.address);

  // Deploy EventFactory with artist factory address
  await deployer.deploy(EventFactory, eventCreationFee, ArtistFactory.address);
  const eventFactory = await EventFactory.deployed();
  console.log("EventFactory deployed at:", EventFactory.address);

  // Link factories
  await artistFactory.setEventFactory(EventFactory.address);
  console.log("Factories linked successfully");

  // Deploy ArtistVenueArbitration with XAOToken address
  await deployer.deploy(ArtistVenueArbitration, XAOToken.address);
  console.log("ArtistVenueArbitration deployed at:", ArtistVenueArbitration.address);

  // Log all deployment addresses
  console.log("\nDeployment Summary:");
  console.log("===================");
  console.log("Network:", network);
  console.log("XAOToken:", XAOToken.address);
  console.log("ArtistFactory:", ArtistFactory.address);
  console.log("EventFactory:", EventFactory.address);
  console.log("ArtistVenueArbitration:", ArtistVenueArbitration.address);
  console.log("Event Creation Fee:", eventCreationFee, "wei");
};
