import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Event } from "../../../build/generated/schema";

export var eventAttrs: string[] = [
  "title",
  "description",
  "type",
  "category",
  "dclX",
  "dclY",
  "city",
  "postalCode",
  "address",
  "socials",
  "email",
  "website",
  "isAvailable",
  "status",
  "inStock",
  "createdAt",
  "updatedAt",
  "image",
  "startDateUTC",
  "endDateUTC",
  "location",
  "timezone",
  "fullAddress",
  "latitude",
  "longitude",
  "mapUrl",
  "organizerLocation",
  "locationName",
  "pixelCode",
  "questions",
  "askBuyerId",
  "askBuyerName",
  "youtubeVideoUrl",
  "extraImages",
  "showAttendees"
];

export var bigIntEventAttrs: string[] = ["startDateUTC", "endDateUTC"];

export function getEventId(eventIdContract: BigInt): string {
  return "e" + eventIdContract.toHex();
}

export function loadOrCreateEvent(eventIdContract: BigInt): Event {
  let eventId = getEventId(eventIdContract);
  let eventEntity = Event.load(eventId);
  if (eventEntity == null) {
    eventEntity = new Event(eventId);
    eventEntity.collaborators = [];
  }
  return eventEntity;
}
