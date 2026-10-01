"""Seed the catalog collections with domains, topics, and questions.

Run with:  python -m app.seed

Only the catalog is touched. Users and exam sessions are left alone, so
re-seeding during development never destroys accounts you are testing with.
"""

import asyncio

from app.db import connect, disconnect, get_db

# Each topic carries at least 12 questions so that the 5-10 random draw
# visibly differs between attempts.
CATALOG: list[dict] = [
    {
        "name": "Cloud Computing",
        "slug": "cloud-computing",
        "description": "Infrastructure, deployment models, and the services that run modern applications.",
        "topics": [
            {
                "name": "AWS Fundamentals",
                "slug": "aws-fundamentals",
                "description": "Core AWS services, regions, and the shared responsibility model.",
                "questions": [
                    ("Which AWS service provides object storage?", ["EBS", "S3", "EFS", "RDS"], 1),
                    ("What does EC2 stand for?", ["Elastic Compute Cloud", "Elastic Container Cloud", "Enterprise Compute Cluster", "Edge Compute Cloud"], 0),
                    ("An AWS Availability Zone is best described as:", ["A country", "One or more discrete data centres within a region", "A single server rack", "A billing boundary"], 1),
                    ("Which service is a managed relational database?", ["DynamoDB", "RDS", "Redshift", "ElastiCache"], 1),
                    ("Under the shared responsibility model, who secures the physical data centre?", ["The customer", "AWS", "Both equally", "A third-party auditor"], 1),
                    ("Which service runs code without provisioning servers?", ["Lambda", "EC2", "Fargate", "Batch"], 0),
                    ("IAM is primarily used for:", ["Monitoring costs", "Managing access and permissions", "Storing secrets", "Load balancing"], 1),
                    ("Which service distributes incoming traffic across targets?", ["Route 53", "CloudFront", "Elastic Load Balancing", "Direct Connect"], 2),
                    ("Amazon CloudFront is a:", ["Content delivery network", "DNS service", "Message queue", "Log aggregator"], 0),
                    ("Which storage class is cheapest for long-term archival?", ["S3 Standard", "S3 Intelligent-Tiering", "S3 Glacier Deep Archive", "S3 One Zone-IA"], 2),
                    ("A VPC gives you:", ["A managed Kubernetes cluster", "An isolated virtual network", "A serverless runtime", "A CI/CD pipeline"], 1),
                    ("Which service collects metrics and logs from AWS resources?", ["CloudTrail", "CloudWatch", "Config", "Inspector"], 1),
                ],
            },
            {
                "name": "Kubernetes",
                "slug": "kubernetes",
                "description": "Container orchestration: pods, services, deployments, and scaling.",
                "questions": [
                    ("What is the smallest deployable unit in Kubernetes?", ["Container", "Pod", "Node", "Deployment"], 1),
                    ("Which object maintains a stable set of replica pods?", ["DaemonSet", "ReplicaSet", "Job", "ConfigMap"], 1),
                    ("A Kubernetes Service primarily provides:", ["Persistent storage", "Stable networking and load balancing for pods", "Image building", "Secret encryption"], 1),
                    ("kubectl communicates with the cluster through:", ["kubelet", "The API server", "etcd directly", "The scheduler"], 1),
                    ("Which component stores all cluster state?", ["etcd", "kube-proxy", "kubelet", "CoreDNS"], 0),
                    ("A DaemonSet ensures:", ["One pod per node", "Exactly three replicas", "Pods run only on master nodes", "Pods restart hourly"], 0),
                    ("Which object stores non-sensitive configuration?", ["Secret", "ConfigMap", "Volume", "Namespace"], 1),
                    ("Namespaces are used to:", ["Encrypt traffic", "Partition cluster resources logically", "Schedule cron jobs", "Store container images"], 1),
                    ("A readiness probe determines whether a pod:", ["Should be restarted", "Can receive traffic", "Has enough memory", "Needs rescheduling"], 1),
                    ("Horizontal Pod Autoscaler scales based on:", ["Node count", "Observed metrics such as CPU", "Image size", "Namespace quota"], 1),
                    ("Which workload type is designed to run to completion?", ["Deployment", "Job", "StatefulSet", "Service"], 1),
                    ("StatefulSet is preferred when pods need:", ["Stable identity and storage", "Faster startup", "Lower memory", "Random scheduling"], 0),
                ],
            },
        ],
    },
    {
        "name": "Web Development",
        "slug": "web-development",
        "description": "Building for the browser: language fundamentals, frameworks, and rendering.",
        "topics": [
            {
                "name": "JavaScript Fundamentals",
                "slug": "javascript-fundamentals",
                "description": "Types, scope, asynchrony, and the behaviour that trips people up.",
                "questions": [
                    ("What does `typeof null` return?", ["null", "object", "undefined", "number"], 1),
                    ("Which keyword declares a block-scoped variable that cannot be reassigned?", ["var", "let", "const", "static"], 2),
                    ("`[1, 2, 3].map(x => x * 2)` returns:", ["[1, 2, 3]", "[2, 4, 6]", "6", "undefined"], 1),
                    ("A Promise that has settled successfully is:", ["pending", "fulfilled", "rejected", "cancelled"], 1),
                    ("`===` differs from `==` in that it:", ["Is faster", "Does not perform type coercion", "Works only on numbers", "Returns a string"], 1),
                    ("Which method creates a shallow copy of an array?", ["slice()", "splice()", "sort()", "reverse()"], 0),
                    ("What is a closure?", ["A function with no arguments", "A function that retains access to its outer scope", "A loop that never ends", "A sealed object"], 1),
                    ("`async` functions always return:", ["undefined", "A Promise", "A callback", "A generator"], 1),
                    ("Which value is NOT falsy?", ["0", "''", "[]", "NaN"], 2),
                    ("The event loop processes microtasks:", ["Before the next macrotask", "After all timers", "Only on page load", "In a worker thread"], 0),
                    ("Optional chaining `a?.b` returns undefined when:", ["b is 0", "a is null or undefined", "a is an array", "b is a function"], 1),
                    ("`Array.prototype.reduce` is used to:", ["Filter elements", "Accumulate into a single value", "Sort in place", "Flatten by one level"], 1),
                ],
            },
            {
                "name": "React & Next.js",
                "slug": "react-nextjs",
                "description": "Components, hooks, rendering strategies, and the App Router.",
                "questions": [
                    ("Which hook manages local component state?", ["useEffect", "useState", "useMemo", "useRef"], 1),
                    ("`useEffect` with an empty dependency array runs:", ["On every render", "Once after the first render", "Never", "Only on unmount"], 1),
                    ("A React key prop helps React:", ["Style elements", "Identify which items changed in a list", "Validate props", "Memoise handlers"], 1),
                    ("In the Next.js App Router, components are by default:", ["Client components", "Server components", "Static only", "Edge functions"], 1),
                    ("Which directive marks a file as a client component?", ["'use server'", "'use client'", "'use strict'", "'client only'"], 1),
                    ("`useMemo` is used to:", ["Cache an expensive computed value", "Trigger side effects", "Replace Redux", "Fetch data"], 0),
                    ("Lifting state up means:", ["Moving state to a common ancestor", "Using global variables", "Storing state in the URL", "Caching in localStorage"], 0),
                    ("Which file defines a shared layout in the App Router?", ["page.tsx", "layout.tsx", "route.ts", "template.tsx"], 1),
                    ("A controlled input is one whose value is:", ["Managed by the DOM", "Driven by React state", "Read-only", "Set via a ref"], 1),
                    ("`useCallback` returns:", ["A memoised value", "A memoised function", "A ref object", "A context value"], 1),
                    ("Dynamic route segments in the App Router use:", ["[id] folders", "_id files", "{id} syntax", ":id syntax"], 0),
                    ("React Context is best suited for:", ["High-frequency updates", "Infrequently changing global values", "Replacing all props", "Server-side fetching"], 1),
                ],
            },
        ],
    },
    {
        "name": "Data & AI",
        "slug": "data-and-ai",
        "description": "Querying data and the fundamentals of training models on it.",
        "topics": [
            {
                "name": "SQL & Databases",
                "slug": "sql-and-databases",
                "description": "Relational querying, joins, indexing, and transactions.",
                "questions": [
                    ("Which clause filters rows before grouping?", ["HAVING", "WHERE", "ORDER BY", "LIMIT"], 1),
                    ("An INNER JOIN returns:", ["All rows from both tables", "Only rows matching in both tables", "All left rows", "Only unmatched rows"], 1),
                    ("A PRIMARY KEY guarantees:", ["Uniqueness and non-null", "Sorted storage", "Foreign references", "Faster writes"], 0),
                    ("Which aggregate counts rows?", ["SUM", "COUNT", "AVG", "MAX"], 1),
                    ("The ACID 'D' stands for:", ["Distributed", "Durability", "Determinism", "Delegation"], 1),
                    ("An index primarily improves:", ["Write speed", "Read lookup speed", "Storage size", "Backup speed"], 1),
                    ("Which clause filters after GROUP BY?", ["WHERE", "HAVING", "DISTINCT", "ON"], 1),
                    ("Normalisation chiefly aims to:", ["Reduce redundancy", "Increase speed", "Add indexes", "Denormalise joins"], 0),
                    ("A LEFT JOIN keeps:", ["Only matches", "All rows from the left table", "All rows from the right table", "Neither table fully"], 1),
                    ("In MongoDB, a document is stored as:", ["A row", "BSON", "CSV", "XML"], 1),
                    ("Which MongoDB stage picks random documents?", ["$match", "$sample", "$limit", "$group"], 1),
                    ("A transaction that fails part way should:", ["Commit partially", "Roll back entirely", "Retry silently", "Lock the table"], 1),
                ],
            },
            {
                "name": "Machine Learning Basics",
                "slug": "machine-learning-basics",
                "description": "Supervised learning, evaluation, and the bias-variance trade-off.",
                "questions": [
                    ("Supervised learning requires:", ["Labelled data", "Unlabelled data", "A reward signal", "No data"], 0),
                    ("Overfitting means the model:", ["Performs poorly everywhere", "Fits training data but generalises badly", "Trains too slowly", "Has too few parameters"], 1),
                    ("Which task predicts a continuous value?", ["Classification", "Regression", "Clustering", "Ranking"], 1),
                    ("A validation set is used to:", ["Train weights", "Tune hyperparameters", "Report final accuracy", "Store features"], 1),
                    ("K-means is an example of:", ["Supervised learning", "Unsupervised learning", "Reinforcement learning", "Transfer learning"], 1),
                    ("High bias typically causes:", ["Overfitting", "Underfitting", "Data leakage", "Slow inference"], 1),
                    ("Precision is defined as:", ["TP / (TP + FP)", "TP / (TP + FN)", "TN / (TN + FP)", "(TP + TN) / total"], 0),
                    ("Gradient descent minimises:", ["The learning rate", "A loss function", "The dataset size", "Model depth"], 1),
                    ("Regularisation is used to:", ["Speed up training", "Reduce overfitting", "Increase model size", "Clean the data"], 1),
                    ("One-hot encoding converts:", ["Numbers to text", "Categorical values to binary vectors", "Images to arrays", "Text to embeddings"], 1),
                    ("A confusion matrix summarises:", ["Feature importance", "Classification predictions versus truth", "Training time", "Learning curves"], 1),
                    ("Cross-validation primarily gives:", ["Faster training", "A more reliable performance estimate", "Smaller models", "Better features"], 1),
                ],
            },
        ],
    },
]


async def seed() -> None:
    await connect()
    db = get_db()

    # Catalog only. Users and exam_sessions are intentionally preserved.
    await db.questions.delete_many({})
    await db.topics.delete_many({})
    await db.domains.delete_many({})

    domain_count = topic_count = question_count = 0

    for domain in CATALOG:
        domain_result = await db.domains.insert_one(
            {
                "name": domain["name"],
                "slug": domain["slug"],
                "description": domain["description"],
            }
        )
        domain_count += 1

        for topic in domain["topics"]:
            topic_result = await db.topics.insert_one(
                {
                    "domain_id": domain_result.inserted_id,
                    "name": topic["name"],
                    "slug": topic["slug"],
                    "description": topic["description"],
                }
            )
            topic_count += 1

            questions = [
                {
                    "topic_id": topic_result.inserted_id,
                    "text": text,
                    "options": options,
                    "correct_option": correct,
                }
                for text, options, correct in topic["questions"]
            ]
            await db.questions.insert_many(questions)
            question_count += len(questions)

    print(f"Seeded {domain_count} domains, {topic_count} topics, {question_count} questions.")
    await disconnect()


if __name__ == "__main__":
    asyncio.run(seed())
