function register(userName) {
  fetch('/user', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName }),
  })
    .then(response => response.json())
    .then(data => {
      console.log("Received from Flask:", data);
    })
    .catch(err => {
      console.error("Error fetching data:", err);
    });
}
