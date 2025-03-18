document.addEventListener("DOMContentLoaded", function () {
    let ctx = document.getElementById("glucoseChart").getContext("2d");

    // Initialize Chart.js
    let glucoseChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: ["Pre-Meal", "1-Hour", "2-Hour"],
            datasets: [
                { label: "Healthy", borderColor: "green", data: [0, 0, 0], fill: false },
                { label: "Prediabetic", borderColor: "orange", data: [0, 0, 0], fill: false },
                { label: "Diabetic", borderColor: "red", data: [0, 0, 0], fill: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 70, // Set lower bound (default fasting glucose)
                    max: 1000, // Set upper bound
                    title: { display: true, text: "Glucose Level (mg/dL)" }
                },
                x: { title: { display: true, text: "Time" } }
            }
        }
    });

    // Function to update values from sliders
    function updateValues() {
        let preMealGlucose = parseFloat(document.getElementById("preMealGlucose").value);
        let bmi = parseFloat(document.getElementById("bmi").value);
        let carbs = parseFloat(document.getElementById("carbs").value);
        let protein = parseFloat(document.getElementById("protein").value);
        let fat = parseFloat(document.getElementById("fat").value);

        // Update displayed values
        document.getElementById("preMealGlucoseValue").innerText = preMealGlucose;
        document.getElementById("bmiValue").innerText = bmi;
        document.getElementById("carbsValue").innerText = carbs;
        document.getElementById("proteinValue").innerText = protein;
        document.getElementById("fatValue").innerText = fat;

        updatePrediction(preMealGlucose, bmi, carbs, protein, fat);
    }

    // Function to calculate glucose spike
    function calculateGlucoseSpike(riskLevel, preMealGlucose, bmi, carbs, protein, fat) {
        const coeffs_1H = {
            "Healthy": { BMI: 0.2, Carbs: 0.08, Protein: -0.03, Fat: 0.01, PreMealGlucose: 0.95 },
            "Prediabetic": { BMI: 0.5, Carbs: 0.12, Protein: -0.02, Fat: 0.05, PreMealGlucose: 1.1 },
            "Diabetic": { BMI: 1.0, Carbs: 0.18, Protein: 0.01, Fat: 0.12, PreMealGlucose: 1.2 }
        };

        const coeffs_2H = {
            "Healthy": { BMI: 0.1, Carbs: 0.05, Protein: -0.02, Fat: 0.01, PreviousGlucose: 0.5 },
            "Prediabetic": { BMI: 0.3, Carbs: 0.08, Protein: -0.03, Fat: 0.03, PreviousGlucose: 0.7 },
            "Diabetic": { BMI: 0.6, Carbs: 0.12, Protein: 0.02, Fat: 0.1, PreviousGlucose: 1.0 }
        };

        let group = riskLevel === 0 ? "Healthy" : riskLevel === 1 ? "Prediabetic" : "Diabetic";

        // Compute **1-hour glucose spike**
        let glucose1H = preMealGlucose +
                        (bmi * coeffs_1H[group].BMI) +
                        (carbs * coeffs_1H[group].Carbs) +
                        (protein * coeffs_1H[group].Protein) +
                        (fat * coeffs_1H[group].Fat) +
                        (preMealGlucose * coeffs_1H[group].PreMealGlucose);

        // Compute **2-hour glucose** based on **1-hour glucose**
        let glucose2H = glucose1H +
                        (bmi * coeffs_2H[group].BMI) +
                        (carbs * coeffs_2H[group].Carbs) +
                        (protein * coeffs_2H[group].Protein) +
                        (fat * coeffs_2H[group].Fat) +
                        (glucose1H * coeffs_2H[group].PreviousGlucose); 

        return { glucose1H, glucose2H };
    }

    // Function to update prediction and chart
    function updatePrediction(preMealGlucose, bmi, carbs, protein, fat) {
        let healthy = calculateGlucoseSpike(0, preMealGlucose, bmi, carbs, protein, fat);
        let prediabetic = calculateGlucoseSpike(1, preMealGlucose, bmi, carbs, protein, fat);
        let diabetic = calculateGlucoseSpike(2, preMealGlucose, bmi, carbs, protein, fat);

        // **Reset chart data before updating**
        glucoseChart.data.datasets.forEach(dataset => dataset.data = []);

        // **Add new calculated values**
        glucoseChart.data.datasets[0].data = [preMealGlucose, healthy.glucose1H, healthy.glucose2H];
        glucoseChart.data.datasets[1].data = [preMealGlucose, prediabetic.glucose1H, prediabetic.glucose2H];
        glucoseChart.data.datasets[2].data = [preMealGlucose, diabetic.glucose1H, diabetic.glucose2H];

        glucoseChart.update();
    }

    // Event Listeners for Sliders
    document.querySelectorAll("input").forEach(input => input.addEventListener("input", updateValues));
    updateValues();
});
