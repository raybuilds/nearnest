function pad(num, length) {
  return String(num).padStart(length, "0");
}

function isSegmentNumber(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function generateOccupantId({ cityCode, corridorCode, hostelCode, roomNumber, occupantIndex }) {
  const parsedCityCode = Number(cityCode);
  const parsedCorridorCode = Number(corridorCode);
  const parsedHostelCode = Number(hostelCode);
  const parsedRoomNumber = Number(roomNumber);
  const parsedOccupantIndex = Number(occupantIndex);

  if (!isSegmentNumber(parsedCityCode, 0, 99)) {
    throw new Error("Invalid cityCode for occupant ID");
  }
  if (!isSegmentNumber(parsedCorridorCode, 0, 999)) {
    throw new Error("Invalid corridorCode for occupant ID");
  }
  if (!isSegmentNumber(parsedHostelCode, 0, 999)) {
    throw new Error("Invalid hostelCode for occupant ID");
  }
  if (!isSegmentNumber(parsedRoomNumber, 0, 999)) {
    throw new Error("Invalid roomNumber for occupant ID");
  }
  if (!isSegmentNumber(parsedOccupantIndex, 1, 9)) {
    throw new Error("Invalid occupantIndex for occupant ID");
  }

  return `${pad(parsedCityCode, 2)}-${pad(parsedCorridorCode, 3)}-${pad(parsedHostelCode, 3)}-${pad(parsedRoomNumber, 3)}-${pad(parsedOccupantIndex, 1)}`;
}

function isValidOccupantId(publicId) {
  return /^[0-9]{2}-[0-9]{3}-[0-9]{3}-[0-9]{3}-[0-9]{1}$/.test(String(publicId || "").trim());
}

module.exports = {
  pad,
  generateOccupantId,
  isValidOccupantId,
};
