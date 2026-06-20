const { gql } = require('graphql-tag');
const typeDefs = gql`
  scalar JSON
  scalar ObjectID
  type Permission { name: String! source: String! }
  type LicenseCategory { type: String! issued: String! }
  type License { id: ObjectID! created: String! suspendedUntil: String hasTheory: Boolean! categories: [LicenseCategory!]! }
  type BankAccount { id: ObjectID! balance: Float! player: Player organisation: Organisation }
  type Player { id: ObjectID! created: String! roblox: String! cash: Float! account: BankAccount permissions: [Permission!]! license: License properties: [Property!]! vehicles: [Vehicle!]! }
  type Vehicle { id: ObjectID! created: String! numberPlate: String! colour: String! make: String! model: String! year: Int! inventory: JSON player: Player org: Organisation property: Property }
  type VehicleMake { name: String! models: [String!]! }
  type VehicleSearchResult { vehicles: [Vehicle!]! total: Int! makes: [VehicleMake!]! }
  type Property { id: ObjectID! created: String! location: String! player: Player }
  type RoleEntry { role: String! salary: Float! permissions: JSON }
  type Organisation { id: ObjectID! created: String! name: String! groupId: String discoverable: Boolean! type: String! tag: String customPermissions: JSON roleSet: [RoleEntry!]! bankAccount: BankAccount }
  type Query {
    player(id: ObjectID, roblox: String): Player
    players(take: Int, skip: Int): [Player!]!
    vehicle(id: ObjectID, numberPlate: String): Vehicle
    vehicles(take: Int! skip: Int player: ObjectID org: ObjectID property: ObjectID): VehicleSearchResult!
    property(id: ObjectID!): Property
    properties(player: ObjectID): [Property!]!
    organisation(id: ObjectID, name: String, group: String): Organisation
    organisations(take: Int, skip: Int): [Organisation!]!
    bankAccount(id: ObjectID!): BankAccount
  }
  input UpdatePlayerInput { cash: Float inventory: JSON }
  input CreateVehicleInput { numberPlate: String! player: ObjectID org: ObjectID property: ObjectID colour: String! make: String! model: String! year: Int! }
  input UpdateVehicleInput { numberPlate: String colour: String make: String model: String year: Int }
  input CreatePropertyInput { location: String! player: ObjectID! }
  input CreateOrganisationInput { name: String! groupId: String discoverable: Boolean type: String tag: String }
  type Mutation {
    updatePlayer(id: ObjectID!, updatePlayerInput: UpdatePlayerInput!): Player!
    createVehicle(createVehicleInput: CreateVehicleInput!): Vehicle!
    updateVehicle(id: ObjectID!, updateVehicleInput: UpdateVehicleInput!): Vehicle!
    deleteVehicle(id: ObjectID!): Boolean!
    createProperty(createPropertyInput: CreatePropertyInput!): Property!
    deleteProperty(id: ObjectID!): Boolean!
    replaceProperty(sellId: ObjectID!, createPropertyInput: CreatePropertyInput!): Property!
    createOrganisation(createOrganisationInput: CreateOrganisationInput!): Organisation!
    updateOrganisation(id: ObjectID!, input: JSON!): Organisation!
    heartbeat(input: JSON!): Boolean!
  }
`;
module.exports = typeDefs;