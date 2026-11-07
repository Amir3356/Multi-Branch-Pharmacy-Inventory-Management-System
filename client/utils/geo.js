// The device's current position, or a rejection with a readable message (blocked, unavailable, timed out)
export const getPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser can't share its location."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      (error) =>
        reject(new Error(error.code === error.PERMISSION_DENIED
          ? 'Location is blocked for this site. Allow it in your browser (the icon left of the address bar), then try again.'
          : "Your location couldn't be found. Check that location services are on, then try again.")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    )
  })
