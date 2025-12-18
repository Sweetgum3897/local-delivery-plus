import sortProducts from "../utils/sortProducts.js";
import expireProducts from "../utils/expireProducts.js";

export default async function cronJobs() {

  try{
    expireProducts();
  }catch (e){
    console.error("❌ Error expiring products:");
    console.error(e);
  }

  try{
    sortProducts();
  }catch (e){
    console.error("❌ Error sorting products:");
    console.error(e);
  }
}

cronJobs();
