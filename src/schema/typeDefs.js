const { gql } = require('graphql-tag');

const typeDefs = gql`
  scalar JSON
  scalar ObjectID

  type Permission { name: String! source: String! }
  type LicenseCategory { type: String! issued: String! }

  type License {
    id: ObjectID! created: String! suspendedUntil: String
    hasTheory: Boolean! endorsements: [String!]! categories: [LicenseCategory!]!
    player: Player
  }

  type BankAccount {
    id: ObjectID! balance: Float!
    player: Player organisation: Organisation
  }

  type Player {
    id: ObjectID! created: String! roblox: String! cash: Float!
    account: BankAccount permissions: [Permission!]!
    license: License properties: [Property!]! vehicles: [Vehicle!]!
  }

  type Vehicle {
    id: ObjectID! created: String! numberPlate: String! colour: String!
    make: String! model: String! year: Int! inventory: JSON
    player: Player org: Organisation property: Property
  }

  type VehicleMake { name: String! models: [String!]! }
  type VehicleSearchResult { vehicles: [Vehicle!]! total: Int! makes: [VehicleMake!]! }

  type Property {
    id: ObjectID! created: String! location: String! player: Player
  }

  type RoleEntry { role: String! salary: Float! permissions: JSON }

  type Organisation {
    id: ObjectID! created: String! name: String! groupId: String
    discoverable: Boolean! type: String! tag: String
    customPermissions: JSON roleSet: [RoleEntry!]! bankAccount: BankAccount
  }

  type Flag {
    id: ObjectID! created: String! expires: String reason: String! active: Boolean!
    playerSubject: Player vehicleSubject: Vehicle issuer: Player
  }

  type FlagSearchResult { flags: [Flag!]! total: Int! }

  type Marker {
    id: ObjectID! created: String! reason: String!
    vehicleSubject: Vehicle issuer: Player
  }

  type MarkerSearchResult { markers: [Marker!]! total: Int! }

  type Charge { name: String! time: Int! payment: Float! }

  type Record {
    id: ObjectID! created: String! type: String!
    issuer: Player subject: Player charges: [Charge!]!
  }

  type RecordSearchResult { records: [Record!]! total: Int! fpns: [Record!] }

  type Transaction {
    id: ObjectID! created: String type: String! amount: Float!
    from: BankAccount to: BankAccount
  }

  type CmdrLog { id: ObjectID! created: String! executor: String command: String args: JSON }

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
    license(id: ObjectID!): License
    flag(id: ObjectID!): Flag
    flags(take: Int! skip: Int! issuer: ObjectID playerSubject: ObjectID vehicleSubject: ObjectID): FlagSearchResult!
    marker(id: ObjectID!): Marker
    markers(take: Int! skip: Int! issuer: ObjectID vehicleSubject: ObjectID): MarkerSearchResult!
    record(id: ObjectID!): Record
    records(subject: ObjectID take: Int! skip: Int! type: String): RecordSearchResult!
    transaction(id: ObjectID!): Transaction
  }

  input UpdatePlayerInput { cash: Float inventory: JSON }
  input CreateVehicleInput { numberPlate: String! player: ObjectID org: ObjectID property: ObjectID colour: String! make: String! model: String! year: Int! }
  input UpdateVehicleInput { numberPlate: String colour: String make: String model: String year: Int }
  input CreatePropertyInput { location: String! player: ObjectID! }
  input CreateOrganisationInput { name: String! groupId: String discoverable: Boolean type: String tag: String }
  input CreateLicenseInput { player: ObjectID! hasTheory: Boolean }
  input UpdateLicenseInput { id: ObjectID! suspendedUntil: String hasTheory: Boolean endorsements: [String!] }
  input CreateFlagInput { reason: String! expires: String playerSubject: ObjectID vehicleSubject: ObjectID issuer: ObjectID }
  input CreateMarkerInput { reason: String! vehicleSubject: ObjectID issuer: ObjectID }
  input CreateRecordInput { type: String! issuer: ObjectID subject: ObjectID charges: JSON }
  input CreateTransactionInput { type: String! amount: Float! from: ObjectID to: ObjectID }
  input CreateCmdrLogInput { executor: String command: String args: JSON }

  type Mutation {
    updatePlayer(id: ObjectID!, updatePlayerInput: UpdatePlayerInput!): Player!
    createVehicle(createVehicleInput: CreateVehicleInput!): Vehicle!
    updateVehicle(id: ObjectID!, updateVehicleInput: UpdateVehicleInput!): Vehicle!
    deleteVehicle(id: ObjectID!): Boolean!
    createProperty(createPropertyInput: CreatePropertyInput!): Property!
    deleteProperty(id: ObjectID!): Boolean!
    sellProperty(id: ObjectID!): Boolean!
    sellAndCreateProperty(sellId: ObjectID!, createPropertyInput: CreatePropertyInput!): Property!
    updateProperty(updatePropertyInput: JSON!): Property!
    replaceProperty(sellId: ObjectID!, createPropertyInput: CreatePropertyInput!): Property!
    createOrganisation(createOrganisationInput: CreateOrganisationInput!): Organisation!
    updateOrganisation(id: ObjectID!, input: JSON!): Organisation!
    createLicense(createLicenseInput: CreateLicenseInput!): License!
    updateLicense(updateLicenseInput: UpdateLicenseInput!): License!
    giveCategory(id: ObjectID!, type: String!): License!
    removeCategory(id: ObjectID!, type: String!): License!
    createFlag(createFlagInput: CreateFlagInput!): Flag!
    removeFlag(id: ObjectID!): Flag!
    createMarker(createMarkerInput: CreateMarkerInput!): Marker!
    removeMarker(id: ObjectID!): Marker!
    createRecord(createRecordInput: CreateRecordInput!): Record!
    createTransaction(createTransactionInput: CreateTransactionInput!): Transaction!
    createCmdrLog(createCmdrLogInput: CreateCmdrLogInput!): CmdrLog!
    heartbeat(input: JSON!): Boolean!
  }
`;

module.exports = typeDefs;
