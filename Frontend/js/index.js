const login_screen = document.getElementById("login-screen");
const register_screen = document.getElementById("register-screen");
const switchBtn = document.getElementById("switch-btn");
const registerBtn = document.getElementById("register");
const loginBtn = document.getElementById("login");
const registerPassword = document.getElementById("register-password");
const registerUsername = document.getElementById("register-username");
const loginPassword = document.getElementById("login-password");
const loginUsername = document.getElementById("login-username");
const isDevelopment = window.location.hostname === "localhost"
const baseUrl = isDevelopment ? "http://localhost:8383" : "https://instagram-tool.duckdns.org:8383";

// Call the function to get the base URL
loginBtn.addEventListener('click', login);
registerBtn.addEventListener('click', register);
registerUsername.addEventListener('input', resetRegister)
registerPassword.addEventListener('input', resetRegister)
loginUsername.addEventListener('input', resetLogin)
loginPassword.addEventListener('input', resetLogin)
document.getElementById("terms").addEventListener('input', resetCheck)
function resetCheck () {
    document.getElementById("check-label").classList.remove("err-message")
    document.getElementById("terms").classList.remove("terms-err")
}
if (window.location.hostname !== "sub1.yourdomain.duckdns.org") {
    window.location.href = "https://sub1.yourdomain.duckdns.org" + window.location.pathname;
  }
window.onload = async function() {
    const res = await fetch(baseUrl + '/protected', { 
        method: 'GET',
        credentials: 'include' 
    })
    if (res.ok) {
        // User is authenticated, redirect to main page
        window.location.href = 'views/main.html'; 
    }
}
// Switches to register screen
function toRegister(){
    login_screen.style.left = "-400px";
    register_screen.style.left = "50px";
    switchBtn.style.left = "110px";
};
// Switches to login screen
function toLogin(){
    login_screen.style.left = "50px";
    register_screen.style.left = "450px";
    switchBtn.style.left = "0px";
};
// Starts fade transition for all transition elements
function transition(){
    const bodyElements = document.querySelectorAll('.transition');
    bodyElements.forEach(element => {
        element.classList.add('fade');
    })

}
// Resets border when user starts typing
function resetLogin() {
    
    document.getElementById("login-message").textContent = ""
    loginPassword.style.borderBottom = '#999 solid 2px'
    loginUsername.style.borderBottom = '#999 solid 2px'
}
// Resets border when user starts typing
function resetRegister() {
    document.getElementById("register-message").textContent = ""
    registerUsername.style.borderBottom = '#999 solid 2px'
    registerPassword.style.borderBottom = '#999 solid 2px'
}
async function register(e) {
    e.preventDefault();
    if (!document.getElementById("terms").checked) {
        document.getElementById("check-label").classList.add("err-message")
        document.getElementById("terms").classList.add("terms-err")
        return;
    }
    // Various Errors
    if (!registerUsername.value && !registerPassword.value) {
        registerUsername.style.borderBottom = 'rgb(255, 0, 0) solid 2px'
        registerPassword.style.borderBottom = 'rgb(255, 0, 0) solid 2px'
        document.getElementById("register-message").textContent = "Username and Password cannot be blank";
        return;
    }
    else if (!registerUsername.value) {
        registerUsername.style.borderBottom = 'rgb(255, 0, 0) solid 2px'
        document.getElementById("register-message").textContent = "Username cannot be blank";
        return;
    }
    else if (!registerPassword.value) {
        registerPassword.style.borderBottom = 'rgb(255, 0, 0) solid 2px'
        document.getElementById("register-message").textContent = "Password cannot be blank";
        return;
    }
    document.getElementById("register").innerHTML = `<div class="lds-ring"><div></div><div></div><div></div><div></div>`
    // Creates form and sends post request to API.
    const formData = new FormData();
    formData.append("password", registerPassword.value);
    formData.append("username", registerUsername.value);
    const res = await fetch(baseUrl + '/register', {
        method: 'POST',
        body: formData,
        credentials: 'include'
    
    });
    document.getElementById("register").innerHTML = "Register"
    if (res.ok) {
        // Display registered message
        document.getElementById("register-message").className = "message"
        document.getElementById("register-message").innerHTML = '<p style="line-height: 24px; font-size: 16px; display: flex; justify-content:center;">Succesful Registered<img src="images/checkmark-svgrepo-com.svg"/></p>'
    }
    else {
        if (res.status === 400) {
            // Display username taken message
            registerUsername.style.borderBottom = 'rgb(255, 0, 0) solid 2px'
            document.getElementById("register-message").className = "err-message"
            document.getElementById("register-message").textContent = "Username already taken";

        }
        else {
            // Display error during registeration, try again later
            document.getElementById("register-message").className = "err-message"
            document.getElementById("register-message").textContent = "Error during registration, try again later";
        };
    };
};
async function login(e) {
    e.preventDefault();
    if (!loginUsername.value || !loginPassword.value) {
        loginUsername.style.borderBottom = 'rgb(255, 0, 0) solid 2px'
        loginPassword.style.borderBottom = 'rgb(255, 0, 0) solid 2px'
        document.getElementById("login-message").textContent = "Incorrect username or password"
        return;
    };
    document.getElementById("login").innerHTML = `<div class="lds-ring"><div></div><div></div><div></div><div></div>`
    // Creates form data and sends a post request to server API.
    const formData = new FormData();
    formData.append("password", loginPassword.value);
    formData.append("username", loginUsername.value);
    formData.append("remember", document.getElementById("remember").checked);
    const res = await fetch(baseUrl + '/login', {
        method: 'POST',
        body: formData,
        credentials: 'include'
        
    });
    if (res.ok) {
        // Sends user to main page, with time for transition to play
        transition();
        setTimeout(() => {
            window.location.href = 'views/main.html';
        }, 200);
    }
    else {
        document.getElementById("login").innerHTML = "Login"
        if (res.status === 400) {
            console.log(res.text())
            // Display username or password incorrect
            loginUsername.style.borderBottom = 'rgb(255, 0, 0) solid 2px'
            loginPassword.style.borderBottom = 'rgb(255, 0, 0) solid 2px'
            document.getElementById("login-message").textContent = "Incorrect username or password"
        }
        else {
            document.getElementById("login-message").textContent = "Error during login, try again later"
            // Display error during login, try again later
        };
    };
};