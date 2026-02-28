function pad(num, length) {
  return String(num).padStart(length, "0");
}

function generateOccupantId({ cityCode, corridorCode, hostelCode, roomNumber, occupantIndex }) {
  return (
    pad(cityCode, 2) +
    pad(corridorCode, 3) +
    pad(hostelCode, 3) +
    pad(roomNumber, 3) +
    pad(occupantIndex, 1)
  );
}

module.exports = {
  pad,
  generateOccupantId,
};
