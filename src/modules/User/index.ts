import { Address } from '@graphprotocol/graph-ts'
import { User } from '../../generated/schema'

export enum DataType {
  PARCEL = 0,
  ESTATE = 1
}

export function loadOrCreateUser(id: Address):  User {
    let user = User.load(id.toHex())
    if (user == null) {
        user = new User(id.toHex())
        user.address = id
        user.save()
    }
    return user
}