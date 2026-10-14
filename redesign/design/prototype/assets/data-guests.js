/* Veil prototype: guests (G1–G8). Loads after data.js. */
(function () {
  const { NORMAL, STRESS, EMPTY } = window.VEIL_DATA;
  const INVITE = [["both", "Both events"], ["ceremony", "Ceremony only"], ["reception", "Reception only"], ["maybe", "Reception if space allows"], ["unsure", "Unsure, living abroad"]];
  const RSVP = [["waiting", "Waiting"], ["yes", "Attending"], ["no", "Not attending"]];
  let n = 0;
  const g = (name, country, conn, invite, sent, rsvp, plus, food) => ({ no: ++n, name, country, conn, invite, sent: !!sent, rsvp, plus: plus || 0, food: food || "" });
  const guests = [
    g("Hendra Santoso", "Indonesia", "Groom's uncle", "both", 1, "yes", 1),
    g("Lina Santoso", "Indonesia", "Groom's aunt", "both", 1, "yes", 0, "No pork"),
    g("Om Budi", "Indonesia", "Groom's father's friend", "reception", 1, "waiting", 2),
    g("Tante Lily", "Indonesia", "Bride's aunt", "both", 1, "yes", 1, "Vegetarian"),
    g("Michael Tan", "Singapore", "Bride's cousin", "both", 1, "waiting", 1),
    g("Sarah Lim", "Singapore", "Bride's colleague", "reception", 1, "yes", 0),
    g("David Wijaya", "Indonesia", "Groom's colleague", "maybe", 1, "waiting", 0),
    g("Ayu Lestari", "Indonesia", "Bride's friend from university", "both", 1, "yes", 1, "Allergic to peanuts"),
    g("Kevin Hartono", "Australia", "Groom's cousin", "unsure", 0, "waiting", 1),
    g("Grace Hartono", "Australia", "Groom's cousin", "unsure", 0, "waiting", 0),
    g("Pak Joko Susilo", "Indonesia", "Groom's business client", "reception", 1, "no", 1),
    g("Ibu Ratna", "Indonesia", "Bride's mother's friend", "ceremony", 1, "yes", 0),
    g("Romo Antonius", "Indonesia", "Parish priest", "ceremony", 1, "yes", 0),
    g("Tia Kusuma", "Indonesia", "Groom's friend", "both", 1, "yes", 1),
    g("Yuki Tanaka", "Japan", "Bride's colleague", "maybe", 0, "waiting", 0, "No raw fish"),
    g("James Carter", "United Kingdom", "Groom's university friend", "unsure", 0, "waiting", 1),
    g("Mei Ling", "Malaysia", "Bride's cousin", "both", 1, "no", 0),
    g("Rudi Halim", "Indonesia", "Neighbour", "reception", 0, "waiting", 1),
    g("Sinta Dewi", "Indonesia", "Bride's sister-in-law", "both", 1, "yes", 2, "Two children's meals"),
    g("Agus Prasetyo", "Indonesia", "Bride's father's business partner", "reception", 1, "yes", 1),
  ];
  Object.assign(NORMAL, { INVITE, RSVP, guests });
  Object.assign(EMPTY, { INVITE, RSVP, guests: [] });

  const sg = [
    { no: 1, name: "Maria Goretti Setyaningsih Wijayakusumaningrat binti Hendrikus Fransiskus", country: "Republik Indonesia (Daerah Istimewa Yogyakarta)", conn: "Bride's grandmother's younger sister's eldest daughter, who raised Bella's mother", invite: "both", sent: true, rsvp: "yes", plus: 12, food: "Soft food only, no salt, no MSG, no spicy food, diabetic: no sugar in desserts, and please seat near the toilets because of the wheelchair. ".repeat(2) },
    { no: 2, name: "王小明", country: "中国", conn: "新郎的同事", invite: "reception", sent: true, rsvp: "waiting", plus: 0, food: "" },
    { no: 3, name: "أحمد العلي", country: "الإمارات", conn: "Groom's friend", invite: "unsure", sent: false, rsvp: "waiting", plus: 1, food: "Halal" },
    { no: 4, name: "X", country: "", conn: "", invite: "both", sent: false, rsvp: "waiting", plus: 0, food: "" },
  ];
  const conns = ["Groom's uncle", "Bride's aunt", "Groom's colleague", "Bride's colleague", "Groom's friend", "Bride's friend", "Groom's business partner", "Bride's cousin", "Neighbour"];
  for (let i = 5; i <= 1500; i++) sg.push({ no: i, name: `Guest ${i}`, country: ["Indonesia", "Singapore", "Australia", "Japan"][i % 4], conn: conns[i % conns.length], invite: INVITE[i % 5][0], sent: i % 3 !== 0, rsvp: RSVP[i % 3][0], plus: i % 4, food: i % 9 === 0 ? "Vegetarian" : "" });
  Object.assign(STRESS, { INVITE, RSVP, guests: sg });
})();
