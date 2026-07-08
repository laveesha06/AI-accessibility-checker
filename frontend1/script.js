const form = document.getElementById("scanForm");
const urlInput = document.getElementById("websiteUrl");
const errorMessage = document.getElementById("errorMessage");
const loading = document.getElementById("loading");

form.addEventListener("submit", function(event) {
    event.preventDefault();

    errorMessage.textContent = "";

    const url = urlInput.value.trim();

    if (!isValidURL(url)) {
        errorMessage.textContent = "Please enter a valid website URL.";
        return;
    }

    loading.classList.remove("hidden");

    setTimeout(() => {
        loading.classList.add("hidden");

        alert("Website scanned successfully!\n\nBackend will be connected in the next step.");
    }, 3000);
});

function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}