// Mobile Menu Toggle
const menuToggle = document.getElementById("menuToggle")
const navLinks = document.getElementById("navLinks")

menuToggle.addEventListener("click", () => {
  navLinks.classList.toggle("active")
})

// Close mobile menu when clicking on a link
navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("active")
  })
})

// Smooth Scrolling
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault()
    const target = document.querySelector(this.getAttribute("href"))
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  })
})

// Opening Hours Configuration
const openingHours = {
  0: null, // Sunday - closed
  1: null, // Monday - closed
  2: { start: 9, end: 18 }, // Tuesday - NOW OPEN
  3: { start: 9, end: 18 }, // Wednesday
  4: { start: 9, end: 18 }, // Thursday
  5: { start: 9, end: 18 }, // Friday
  6: { start: 8, end: 15 }, // Saturday
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"
import { getDatabase, ref, push, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js"

// Firebase configuration - User needs to replace with their own config
const firebaseConfig = {
  apiKey: "AIzaSyAsrN8hUNHkXmtXW2C4h-cloI8o_8rhyQM",
  authDomain: "trend-hair-studio.firebaseapp.com",
  databaseURL: "https://trend-hair-studio-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "trend-hair-studio",
  storageBucket: "trend-hair-studio.firebasestorage.app",
  messagingSenderId: "1076468832173",
  appId: "1:1076468832173:web:4ea3dbfb893d3a95a5f324",
}

// Initialize Firebase
let app, database, bookingsRef, blockedDatesRef, contactMessagesRef, employeeBlockedDatesRef
try {
  app = initializeApp(firebaseConfig)
  database = getDatabase(app)
  bookingsRef = ref(database, "bookings")
  blockedDatesRef = ref(database, "blockedDates")
  contactMessagesRef = ref(database, "contactMessages") // New reference for contact messages
  employeeBlockedDatesRef = ref(database, "employeeBlockedDates") // Added reference for employee-specific blocked dates
  console.log("[v0] Firebase initialized successfully")
} catch (error) {
  console.error("[v0] Firebase initialization error:", error)
  console.log("[v0] Please configure Firebase in script.js")
}

// Calendar state and stylist tracking
const currentCalendarDate = new Date()
let selectedDate = null
let selectedTime = null
let selectedStylist = null
let blockedDatesCache = []
let bookingsCache = []
let employeeBlockedDatesCache = {} // Added cache for employee blocked dates

document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] DOM loaded, initializing calendar")
  initCalendar()
})

// Initialize calendar
function initCalendar() {
  console.log("[v0] initCalendar called")

  const calendarElement = document.getElementById("calendar")
  if (!calendarElement) {
    console.error("[v0] Calendar element not found!")
    return
  }

  console.log("[v0] Calendar element found")

  // Render calendar immediately
  renderCalendar()

  // Attach navigation buttons
  const prevBtn = document.getElementById("prevMonth")
  const nextBtn = document.getElementById("nextMonth")

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener("click", () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1)
      renderCalendar()
    })

    nextBtn.addEventListener("click", () => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1)
      renderCalendar()
    })
    console.log("[v0] Calendar navigation attached")
  }

  // Attach stylist selection handler
  const stylistSelect = document.getElementById("stylistSelect")
  if (stylistSelect) {
    stylistSelect.addEventListener("change", (e) => {
      selectedStylist = e.target.value
      renderCalendar() // Re-render calendar when stylist changes to show employee-specific blocked dates
      if (selectedDate && selectedStylist) {
        updateTimeSlots()
      }
    })
    console.log("[v0] Stylist selection handler attached")
  }

  console.log("[v0] Calendar initialized successfully")
}

async function renderCalendar() {
  console.log("[v0] Rendering calendar")

  const year = currentCalendarDate.getFullYear()
  const month = currentCalendarDate.getMonth()

  // Update header
  const monthNames = [
    "Styczeń",
    "Luty",
    "Marzec",
    "Kwiecień",
    "Maj",
    "Czerwiec",
    "Lipiec",
    "Sierpień",
    "Wrzesień",
    "Październik",
    "Listopad",
    "Grudzień",
  ]

  const monthHeader = document.getElementById("calendarMonth")
  if (monthHeader) {
    monthHeader.textContent = `${monthNames[month]} ${year}`
  }

  // Get blocked dates and bookings
  try {
    if (database) {
      blockedDatesCache = await getBlockedDates()
      bookingsCache = await getAllBookings()
      employeeBlockedDatesCache = await getEmployeeBlockedDates() // Get employee-specific blocked dates
    }
  } catch (error) {
    console.log("[v0] Could not fetch data from Firebase:", error)
    blockedDatesCache = []
    bookingsCache = []
    employeeBlockedDatesCache = {}
  }

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
  const lastDate = lastDay.getDate()
  const prevLastDay = new Date(year, month, 0)
  const prevLastDate = prevLastDay.getDate()

  const calendar = document.getElementById("calendar")
  if (!calendar) {
    console.error("[v0] Calendar element not found during render!")
    return
  }

  calendar.innerHTML = ""

  // Day headers
  const dayHeaders = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"]
  dayHeaders.forEach((day) => {
    const header = document.createElement("div")
    header.className = "calendar-day-header"
    header.textContent = day
    calendar.appendChild(header)
  })

  // Previous month days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = document.createElement("div")
    day.className = "calendar-day other-month"
    day.textContent = prevLastDate - i
    calendar.appendChild(day)
  }

  // Current month days
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 1; i <= lastDate; i++) {
    const day = document.createElement("div")
    const currentDate = new Date(year, month, i)
    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}` // Fixed date string to use local date without timezone offset
    const dayOfWeek = currentDate.getDay()

    day.className = "calendar-day"
    day.textContent = i

    // Check if today
    if (currentDate.getTime() === today.getTime()) {
      day.classList.add("today")
    }

    // Check if in the past
    if (currentDate < today) {
      day.classList.add("closed")
    }
    // Check if closed (Sunday or Monday)
    else if (dayOfWeek === 0 || dayOfWeek === 1) {
      day.classList.add("closed")
    } else if (
      blockedDatesCache.includes(dateString) ||
      (selectedStylist && employeeBlockedDatesCache[selectedStylist]?.includes(dateString))
    ) {
      day.classList.add("blocked")
    }
    // Available
    else {
      day.classList.add("available")
      day.addEventListener("click", () => selectDate(dateString, day))
    }

    // Check if selected
    if (selectedDate === dateString) {
      day.classList.add("selected")
    }

    calendar.appendChild(day)
  }

  // Next month days
  const totalCells = calendar.children.length - 7
  const remainingCells = 42 - totalCells - 7

  for (let i = 1; i <= remainingCells; i++) {
    const day = document.createElement("div")
    day.className = "calendar-day other-month"
    day.textContent = i
    calendar.appendChild(day)
  }

  console.log("[v0] Calendar rendered successfully")
}

function selectDate(dateString, dayElement) {
  selectedDate = dateString
  selectedTime = null

  // Update calendar UI
  document.querySelectorAll(".calendar-day").forEach((d) => d.classList.remove("selected"))
  dayElement.classList.add("selected")

  // Update time slots
  if (selectedStylist) {
    updateTimeSlots()
  } else {
    const timeSlotsContainer = document.getElementById("timeSlots")
    timeSlotsContainer.innerHTML =
      '<p class="time-slots-placeholder">Wybierz fryzjera, aby zobaczyć dostępne godziny</p>'
  }
}

async function updateTimeSlots() {
  if (!selectedDate || !selectedStylist) return

  const [year, month, day] = selectedDate.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  const dayOfWeek = date.getDay()
  const hours = openingHours[dayOfWeek]

  const timeSlotsContainer = document.getElementById("timeSlots")
  timeSlotsContainer.innerHTML = ""

  if (!hours) {
    timeSlotsContainer.innerHTML = '<p class="time-slots-placeholder">Salon nieczynny w tym dniu</p>'
    return
  }

  // Generate time slots
  const slots = []
  for (let hour = hours.start; hour < hours.end; hour++) {
    slots.push(`${hour.toString().padStart(2, "0")}:00`)
    if (hour + 0.5 < hours.end) {
      slots.push(`${hour.toString().padStart(2, "0")}:30`)
    }
  }

  // Check which slots are booked for this stylist
  const bookedSlots = bookingsCache
    .filter((b) => b.date === selectedDate && b.stylist === selectedStylist)
    .map((b) => b.time)

  slots.forEach((slot) => {
    const slotElement = document.createElement("div")
    slotElement.className = "time-slot"
    slotElement.textContent = slot

    if (bookedSlots.includes(slot)) {
      slotElement.classList.add("booked")
    } else {
      slotElement.addEventListener("click", () => selectTimeSlot(slot, slotElement))
    }

    if (selectedTime === slot) {
      slotElement.classList.add("selected")
    }

    timeSlotsContainer.appendChild(slotElement)
  })
}

function selectTimeSlot(time, slotElement) {
  selectedTime = time

  // Update UI
  document.querySelectorAll(".time-slot").forEach((s) => s.classList.remove("selected"))
  slotElement.classList.add("selected")
}

async function getBlockedDates() {
  if (!database) return []
  try {
    const snapshot = await get(blockedDatesRef)
    if (snapshot.exists()) {
      return Object.values(snapshot.val())
    }
  } catch (error) {
    console.log("[v0] Error fetching blocked dates:", error)
  }
  return []
}

async function getEmployeeBlockedDates() {
  if (!database) return {}
  try {
    const snapshot = await get(employeeBlockedDatesRef)
    if (snapshot.exists()) {
      return snapshot.val()
    }
  } catch (error) {
    console.log("[v0] Error fetching employee blocked dates:", error)
  }
  return {}
}

async function getAllBookings() {
  if (!database) return []
  try {
    const snapshot = await get(bookingsRef)
    if (snapshot.exists()) {
      return Object.values(snapshot.val())
    }
  } catch (error) {
    console.log("[v0] Error fetching bookings:", error)
  }
  return []
}

// Booking Form Submission
const bookingForm = document.getElementById("bookingForm")
bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault()

  if (!selectedDate || !selectedTime || !selectedStylist) {
    showModal("Proszę wybrać datę, godzinę i fryzjera.")
    return
  }

  if (!database) {
    showModal("Błąd: Firebase nie jest skonfigurowany. Skontaktuj się z administratorem.")
    return
  }

  // Validate that time slot is still available
  const bookings = await getAllBookings()
  const isBooked = bookings.some(
    (b) => b.date === selectedDate && b.time === selectedTime && b.stylist === selectedStylist,
  )

  if (isBooked) {
    showModal("Przepraszamy, ten termin został już zarezerwowany. Proszę wybrać inny.")
    bookingsCache = await getAllBookings()
    updateTimeSlots()
    return
  }

  const booking = {
    name: document.getElementById("clientName").value,
    phone: document.getElementById("clientPhone").value,
    email: document.getElementById("clientEmail").value,
    service: document.getElementById("serviceType").value,
    stylist: selectedStylist,
    date: selectedDate,
    time: selectedTime,
    notes: document.getElementById("bookingNotes").value,
    createdAt: new Date().toISOString(),
    status: "pending",
  }

  try {
    const newBookingRef = push(bookingsRef)
    await set(newBookingRef, booking)

    showModal(
      `Dziękujemy ${booking.name}! Twoja wizyta została zarezerwowana na ${booking.date} o godzinie ${booking.time} z ${booking.stylist}.`,
    )

    // Reset form
    bookingForm.reset()
    selectedDate = null
    selectedTime = null
    selectedStylist = null
    bookingsCache = await getAllBookings()
    renderCalendar()
    document.getElementById("timeSlots").innerHTML =
      '<p class="time-slots-placeholder">Wybierz datę i fryzjera, aby zobaczyć dostępne godziny</p>'
  } catch (error) {
    console.error("[v0] Error saving booking:", error)
    showModal("Wystąpił błąd podczas rezerwacji. Spróbuj ponownie.")
  }
})

// Contact Form Submission
const contactForm = document.getElementById("contactForm")
contactForm.addEventListener("submit", async (e) => {
  e.preventDefault()

  const name = document.getElementById("contactName").value
  const email = document.getElementById("contactEmail").value
  const message = document.getElementById("contactMessage").value

  if (database && contactMessagesRef) {
    try {
      const contactMessage = {
        name: name,
        email: email,
        message: message,
        createdAt: new Date().toISOString(),
        status: "unread",
      }

      await push(contactMessagesRef, contactMessage)
      console.log("[v0] Contact message saved to Firebase")
    } catch (error) {
      console.error("[v0] Error saving contact message:", error)
    }
  }

  showModal(`Dziękujemy ${name}! Twoja wiadomość została wysłana. Skontaktujemy się z Tobą wkrótce.`)

  contactForm.reset()
})

// Modal Functions
const modal = document.getElementById("successModal")
const closeBtn = document.querySelector(".close")

function showModal(message) {
  document.getElementById("modalMessage").textContent = message
  modal.style.display = "block"
}

closeBtn.addEventListener("click", () => {
  modal.style.display = "none"
})

window.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none"
  }
})

// Gallery Image Click
document.querySelectorAll(".gallery-item").forEach((item) => {
  item.addEventListener("click", () => {
    console.log("Gallery item clicked")
  })
})

// Scroll Animation
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1"
      entry.target.style.transform = "translateY(0)"
    }
  })
}, observerOptions)

// Observe all sections
document.querySelectorAll("section").forEach((section) => {
  section.style.opacity = "0"
  section.style.transform = "translateY(20px)"
  section.style.transition = "opacity 0.6s ease, transform 0.6s ease"
  observer.observe(section)
})
