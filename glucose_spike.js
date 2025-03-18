document.addEventListener("DOMContentLoaded", function () {
    let ctx = document.getElementById("glucoseChart").getContext("2d");

    // Initialize chart
    let glucoseChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: ["Pre-Meal", "1-Hour", "2-Hour"],
            datasets: [
                { label: "Healthy", borderColor: "green", data: [], fill: false },
                { label: "Prediabetic", borderColor: "orange", data: [], fill: false },
                { label: "Diabetic", borderColor: "red", data: [], fill: false }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: "Glucose Level (mg/dL)" } },
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
        let fiber = parseFloat(document.getElementById("fiber").value);

        document.getElementById("preMealGlucoseValue").innerText = preMealGlucose;
        document.getElementById("bmiValue").innerText = bmi;
        document.getElementById("carbsValue").innerText = carbs;
        document.getElementById("proteinValue").innerText = protein;
        document.getElementById("fatValue").innerText = fat;
        document.getElementById("fiberValue").innerText = fiber;

        updatePrediction(preMealGlucose, bmi, carbs, protein, fat, fiber);
    }

    // Function to calculate glucose spike using Linear Regression Coefficients
    function calculateGlucoseSpike(diabetesRisk, preMealGlucose, bmi, carbs, protein, fat, fiber) {
        const coeffs_1H = { Diabetes_Risk: 4.5833, BMI: -0.1660, Carbs: 0.0881, Protein: -0.0253, Fat: 0.0082, Fiber: -0.0091 };
        const coeffs_2H = { Diabetes_Risk: 12.5774, BMI: -0.0119, Carbs: 0.1635, Protein: -0.0460, Fat: 0.0322, Fiber: -0.0176 };

        let predictedSpike1H = (diabetesRisk * coeffs_1H.Diabetes_Risk) +
                               (bmi * coeffs_1H.BMI) +
                               (carbs * coeffs_1H.Carbs) +
                               (protein * coeffs_1H.Protein) +
                               (fat * coeffs_1H.Fat) +
                               (fiber * coeffs_1H.Fiber);

        let predictedSpike2H = (diabetesRisk * coeffs_2H.Diabetes_Risk) +
                               (bmi * coeffs_2H.BMI) +
                               (carbs * coeffs_2H.Carbs) +
                               (protein * coeffs_2H.Protein) +
                               (fat * coeffs_2H.Fat) +
                               (fiber * coeffs_2H.Fiber);

        return {
            glucose1H: preMealGlucose + predictedSpike1H,
            glucose2H: preMealGlucose + predictedSpike2H
        };
    }

    // Function to update prediction and chart
    function updatePrediction(preMealGlucose, bmi, carbs, protein, fat, fiber) {
        let healthy = calculateGlucoseSpike(0, preMealGlucose, bmi, carbs, protein, fat, fiber);
        let prediabetic = calculateGlucoseSpike(1, preMealGlucose, bmi, carbs, protein, fat, fiber);
        let diabetic = calculateGlucoseSpike(2, preMealGlucose, bmi, carbs, protein, fat, fiber);

        document.getElementById("predPreMeal").innerText = preMealGlucose;
        document.getElementById("pred1H").innerText = diabetic.glucose1H.toFixed(2);
        document.getElementById("pred2H").innerText = diabetic.glucose2H.toFixed(2);

        glucoseChart.data.datasets[0].data = [preMealGlucose, healthy.glucose1H, healthy.glucose2H];
        glucoseChart.data.datasets[1].data = [preMealGlucose, prediabetic.glucose1H, prediabetic.glucose2H];
        glucoseChart.data.datasets[2].data = [preMealGlucose, diabetic.glucose1H, diabetic.glucose2H];

        glucoseChart.update();
    }

    document.querySelectorAll("input").forEach(input => input.addEventListener("input", updateValues));
    updateValues();
});
