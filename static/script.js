const form = document.getElementById("scanForm");
const urlInput = document.getElementById("websiteUrl");
const errorMessage = document.getElementById("errorMessage");
const loading = document.getElementById("loading");

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    errorMessage.textContent = "";
    loading.classList.remove("hidden");

    try {
        const response = await fetch("/scan", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                website_url: urlInput.value
            })
        });

        const data = await response.json();

        loading.classList.add("hidden");

        if (!response.ok) {
            errorMessage.textContent = data.error;
            return;
        }

        // Go to results page
        window.location.href = `/results/${data.result_id}`;

    } catch (err) {
        loading.classList.add("hidden");
        errorMessage.textContent = "Something went wrong.";
        console.error(err);
    }
});