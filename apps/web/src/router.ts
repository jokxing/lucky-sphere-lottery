import { createRouter, createWebHistory } from "vue-router";
import Home from "./views/Home.vue";
import AdminHome from "./views/admin/AdminHome.vue";
import AdminEvent from "./views/admin/AdminEvent.vue";
import AdminRooms from "./views/admin/AdminRooms.vue";
import AdminRoom from "./views/admin/AdminRoom.vue";
import Signup from "./views/public/Signup.vue";
import Results from "./views/public/Results.vue";
import Draw from "./views/public/Draw.vue";
import RoomNew from "./views/rooms/RoomNew.vue";
import RoomPlay from "./views/rooms/RoomPlay.vue";
import RoomBoard from "./views/rooms/RoomBoard.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/admin", component: AdminHome },
    { path: "/admin/events/:eventId", component: AdminEvent, props: true },
    { path: "/admin/rooms", component: AdminRooms },
    { path: "/admin/rooms/:roomId", component: AdminRoom, props: true },
    { path: "/events/:eventId/signup", component: Signup, props: true },
    { path: "/events/:eventId/results", component: Results, props: true },
    { path: "/events/:eventId/draw", component: Draw, props: true },
    { path: "/rooms/new", component: RoomNew },
    { path: "/rooms/:roomId", component: RoomPlay, props: true },
    { path: "/rooms/:roomId/board", component: RoomBoard, props: true },
  ],
});


